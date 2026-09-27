
const db = require('../config/db');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { notifyFarmer } = require('../utils/notify');

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
    `SELECT * FROM slots
     WHERE centre_id = $1 ${dateFilter}
     ORDER BY slot_date, start_time`,
    params
  );

  return res.json(result.rows);
}

async function bookSlot(req, res) {
  const { slotId, cropId, farmerId } = req.body || {};
  const role = req.user?.role;

  if (role !== 'farmer' && role !== 'operator') {
    return res.status(403).json({ error: 'Booking is not permitted for this role.' });
  }

  const resolvedFarmerId =
    role === 'farmer' ? req.user.farmerId : farmerId;

  if (!slotId || !cropId || !resolvedFarmerId) {
    return res.status(400).json({
      error: 'slotId, cropId and farmerId (for operators) are required.'
    });
  }

  const client = await db.getClient();
  let inTransaction = false;

  try {
    await client.query('BEGIN');
    inTransaction = true;

    // Lock the slot so concurrent bookings cannot take the last seat.
    const slotResult = await client.query(
      `SELECT s.*, c.name AS centre_name,
              to_char(s.slot_date, 'YYYY-MM-DD') AS slot_date_text
       FROM slots s
       JOIN centres c ON c.id = s.centre_id
       WHERE s.id = $1
       FOR UPDATE OF s`,
      [slotId]
    );

    const slot = slotResult.rows[0];

    if (!slot) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(404).json({ error: 'Slot not found.' });
    }

    // Reject bookings for slots whose date has already passed.
    // Comparing via Postgres CURRENT_DATE avoids any Node/JS timezone issues.
    const expiredCheck = await client.query(
      `SELECT slot_date < CURRENT_DATE AS expired FROM slots WHERE id = $1`,
      [slotId]
    );
    if (expiredCheck.rows[0]?.expired) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(409).json({ error: 'This slot has already passed and cannot be booked.' });
    }

    if (
      slot.status !== 'OPEN' ||
      Number(slot.booked_count) >= Number(slot.capacity)
    ) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(409).json({
        error: 'This slot is full. Please choose another slot.'
      });
    }

    // Verify that the selected crop belongs to this farmer.
    const cropResult = await client.query(
      `SELECT id FROM crops
       WHERE id = $1 AND farmer_id = $2
       FOR SHARE`,
      [cropId, resolvedFarmerId]
    );

    if (!cropResult.rows[0]) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(404).json({
        error: 'Crop not found for the selected farmer.'
      });
    }

    // Reserve a place in the slot.
    const newCount = Number(slot.booked_count) + 1;
    const newStatus =
      newCount >= Number(slot.capacity) ? 'FULL' : 'OPEN';

    await client.query(
      `UPDATE slots
       SET booked_count = $1, status = $2
       WHERE id = $3`,
      [newCount, newStatus, slotId]
    );

    // Assign the next available queue position.
    const positionResult = await client.query(
      `SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_position
       FROM tokens
       WHERE slot_id = $1
         AND status NOT IN ('COMPLETED', 'CANCELLED')`,
      [slotId]
    );

    const queuePosition = Number(positionResult.rows[0].next_position);

    // Create the token in the same transaction as the booking.
    const sequenceResult = await client.query(
      `SELECT nextval(pg_get_serial_sequence('tokens', 'id')) AS seq`
    );

    const tokenId = Number(sequenceResult.rows[0].seq);
    const tokenNumber = generateTokenNumber(tokenId);

    const tokenResult = await client.query(
      `INSERT INTO tokens
         (id, token_number, farmer_id, crop_id, slot_id,
          queue_position, status, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'WAITING', $7)
       RETURNING *`,
      [
        tokenId,
        tokenNumber,
        resolvedFarmerId,
        cropId,
        slotId,
        queuePosition,
        role === 'operator' ? req.user.id : null
      ]
    );

    const farmerResult = await client.query(
      `SELECT u.phone
       FROM farmers f
       JOIN users u ON u.id = f.user_id
       WHERE f.id = $1`,
      [resolvedFarmerId]
    );

    const phone = farmerResult.rows[0]?.phone || null;

    await client.query('COMMIT');
    inTransaction = false;

    // Notifications are sent only after the booking is committed.
    // A notification failure must not undo a successful booking.
    try {
      await notifyFarmer(
        resolvedFarmerId,
        `Your procurement slot is ${slot.slot_date_text}, ` +
          `${slot.start_time}-${slot.end_time}. ` +
          `Token: ${tokenNumber}. Centre: ${slot.centre_name}.`,
        { channel: phone ? 'SMS' : 'APP', phone }
      );
    } catch (notificationError) {
      console.error('Booking notification failed:', notificationError);
    }

    return res.status(201).json(tokenResult.rows[0]);
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Booking rollback failed:', rollbackError);
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listSlotsForCentre, bookSlot };