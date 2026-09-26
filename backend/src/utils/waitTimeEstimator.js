/**
 * Transparent, rules-based waiting-time estimate for the MVP.
 * Deliberately NOT a black-box ML score: the app shows the same
 * inputs used here so a farmer or officer can see why the number
 * is what it is (e.g. "18 ahead + 2 active counters + avg 4 min/farmer").
 */
function estimateWaitMinutes({ farmersAhead, activeCounters, avgMinutesPerFarmer }) {
  const counters = Math.max(1, activeCounters || 1);
  const avgTime = avgMinutesPerFarmer || 4;
  const minutes = Math.ceil((farmersAhead / counters) * avgTime);

  return {
    minutes,
    explanation: `${farmersAhead} ahead + ${counters} active counter${counters > 1 ? 's' : ''} + avg ${avgTime} min/farmer`
  };
}

module.exports = { estimateWaitMinutes };
