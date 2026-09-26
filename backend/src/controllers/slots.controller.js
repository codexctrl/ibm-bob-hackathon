const db = require('../config/db');

async function listSlotsForCentre(req, res) {
  const { id } = req.params;
  const { date } = req.query;

  const params = [id];
  let dateFilter = '';
  if (date) {
    params.push(date);
    dateFilter = 'AND slot_date = $2';
  } else {
    dateFilter = 'AND slot_date >= CURRENT_DATE';
  }

  const result = await db.query(
    `SELECT * FROM slots WHERE centre_id = $1 ${dateFilter} ORDER BY slot_date, start_time`,
    params
  );
  return res.json(result.rows);
}

/**
 * Books a slot: increments booked_count (capping at capacity),
 * flips status to FULL when exhausted. Uses a transaction with a
 * row lock so two farmers can't both grab the last seat.
 */
async function bookSlot(req, res) {
  const { slotId } = req.body;
  if (!slotId) return res.status(400).json({ error: 'slotId is required' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const slotResult = await client.query(`SELECT * FROM slots WHERE id = $1 FOR UPDATE`, [slotId]);
    const slot = slotResult.rows[0];
    if (!slot) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (slot.status !== 'OPEN' || slot.booked_count >= slot.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This slot is full. Please choose another slot.' });
    }

    const newCount = slot.booked_count + 1;
    const newStatus = newCount >= slot.capacity ? 'FULL' : 'OPEN';

    const updated = await client.query(
      `UPDATE slots SET booked_count = $1, status = $2 WHERE id = $3 RETURNING *`,
      [newCount, newStatus, slotId]
    );

    await client.query('COMMIT');
    return res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listSlotsForCentre, bookSlot };
