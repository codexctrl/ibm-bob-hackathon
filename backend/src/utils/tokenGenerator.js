/**
 * Generates a human-readable token number like "CF45281".
 * Uses the numeric primary key sequence value passed in so numbers
 * stay unique without a second round-trip to the database.
 */
function generateTokenNumber(sequenceValue) {
  const padded = String(sequenceValue).padStart(4, '0');
  return `CF${padded}`;
}

/**
 * Generates a farmer code like "CF100245" from a farmer row id.
 */
function generateFarmerCode(farmerId) {
  return `CF1${String(farmerId).padStart(5, '0')}`;
}

module.exports = { generateTokenNumber, generateFarmerCode };
