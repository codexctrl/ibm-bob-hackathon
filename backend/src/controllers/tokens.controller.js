const db = require('../config/db');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { notifyFarmer } = require('../utils/notify');

/**
 * Issues a token for a farmer's crop against a booked slot, and
 * places them at the back of that slot's queue. Works the same way
 * whether called from the farmer app or the assisted-access portal.
 */
async function issueToken(req, res) {
  const { farmerId, cropId, slotId } = req.body;
  const resolvedFarmerId = req.user.role === 'farmer' ? req.user.farmerId : farmerId;

  if (!resolvedFarmerId || !cropId || !slotId) {
    return res.status(400).json({ error: 'farmerId, cropId and slotId are required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const positionResult = await client.query(
      `SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_position
       FROM tokens WHERE slot_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')`,
      [slotId]
    );
    const queuePosition = positionResult.rows[0].next_position;

    const tokenNumberSeed = await client.query(`SELECT nextval(pg_get_serial_sequence('tokens','id')) AS seq`);
    const tokenNumber = generateTokenNumber(tokenNumberSeed.rows[0].seq);

    const insertResult = await client.query(
      `INSERT INTO tokens (id, token_number, farmer_id, crop_id, slot_id, queue_position, status, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'WAITING', $7) RETURNING *`,
      [
        tokenNumberSeed.rows[0].seq,
        tokenNumber,
        resolvedFarmerId,
        cropId,
        slotId,
        queuePosition,
        req.user.role === 'operator' ? req.user.id : null
      ]
    );
    const token = insertResult.rows[0];

    const slotResult = await client.query(
      `SELECT s.slot_date, s.start_time, s.end_time, c.name AS centre_name
       FROM slots s JOIN centres c ON c.id = s.centre_id WHERE s.id = $1`,
      [slotId]
    );
    const slot = slotResult.rows[0];

    const farmerResult = await client.query(
      `SELECT u.phone FROM farmers f JOIN users u ON u.id = f.user_id WHERE f.id = $1`,
      [resolvedFarmerId]
    );
    const phone = farmerResult.rows[0] ? farmerResult.rows[0].phone : null;

    await client.query('COMMIT');

    await notifyFarmer(
      resolvedFarmerId,
      `Your procurement slot is ${slot.slot_date.toISOString().slice(0, 10)}, ${slot.start_time}-${slot.end_time}. Token: ${tokenNumber}. Centre: ${slot.centre_name}.`,
      { channel: phone ? 'SMS' : 'APP', phone }
    );

    return res.status(201).json(token);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getToken(req, res) {
  const { id } = req.params;
  const result = await db.query(
    `SELECT t.*, c.crop_type, c.quantity_bags, s.slot_date, s.start_time, s.end_time,
            ce.name AS centre_name, ce.active_counters, ce.avg_minutes_per_farmer
     FROM tokens t
     JOIN crops c ON c.id = t.crop_id
     JOIN slots s ON s.id = t.slot_id
     JOIN centres ce ON ce.id = s.centre_id
     WHERE t.id = $1`,
    [id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Token not found' });
  return res.json(result.rows[0]);
}

/**
 * Officer moves a token through the workflow:
 * WAITING -> CALLED -> GATE_ENTERED -> WEIGHING -> QUALITY_CHECK -> PROCUREMENT -> COMPLETED
 * (or CANCELLED at any point). Advancing a token also re-numbers the
 * queue positions behind it so everyone's live position stays accurate.
 */
async function updateTokenStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['WAITING', 'CALLED', 'GATE_ENTERED', 'WEIGHING', 'QUALITY_CHECK', 'PROCUREMENT', 'COMPLETED', 'CANCELLED'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(`SELECT * FROM tokens WHERE id = $1 FOR UPDATE`, [id]);
    const token = tokenResult.rows[0];
    if (!token) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Token not found' });
    }

    const updated = await client.query(
      `UPDATE tokens SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (status === 'COMPLETED' || status === 'CANCELLED') {
      // Close the gap: shift everyone behind this token up by one position.
      await client.query(
        `UPDATE tokens SET queue_position = queue_position - 1
         WHERE slot_id = $1 AND queue_position > $2 AND status NOT IN ('COMPLETED','CANCELLED')`,
        [token.slot_id, token.queue_position]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, 'token', $3)`,
      [req.user.id, `token_status_${status.toLowerCase()}`, id]
    );

    await client.query('COMMIT');

    await notifyFarmer(
      token.farmer_id,
      `Token ${token.token_number}: status updated to ${status.replace('_', ' ')}.`,
      { channel: 'APP' }
    );

    return res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { issueToken, getToken, updateTokenStatus };
