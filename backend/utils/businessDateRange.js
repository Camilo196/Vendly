const MINUTES_IN_MS = 60 * 1000;
const DAY_IN_MS = 24 * 60 * MINUTES_IN_MS;

function getBusinessUtcOffsetMinutes() {
  const configuredOffset = Number(process.env.BUSINESS_UTC_OFFSET_MINUTES);
  return Number.isFinite(configuredOffset) ? configuredOffset : -300;
}

function getBusinessLocalDate(date = new Date()) {
  const offsetMinutes = getBusinessUtcOffsetMinutes();
  return new Date(date.getTime() + offsetMinutes * MINUTES_IN_MS);
}

function getBusinessDayRange(date = new Date()) {
  const offsetMinutes = getBusinessUtcOffsetMinutes();
  const localDate = getBusinessLocalDate(date);
  const startUtcTimestamp =
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate()
    ) - offsetMinutes * MINUTES_IN_MS;

  return {
    from: new Date(startUtcTimestamp),
    to: new Date(startUtcTimestamp + DAY_IN_MS)
  };
}

function getBusinessMonthRange(date = new Date(), monthOffset = 0) {
  const offsetMinutes = getBusinessUtcOffsetMinutes();
  const localDate = getBusinessLocalDate(date);
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth() + monthOffset;
  const startUtcTimestamp = Date.UTC(year, month, 1) - offsetMinutes * MINUTES_IN_MS;
  const endUtcTimestamp = Date.UTC(year, month + 1, 1) - offsetMinutes * MINUTES_IN_MS;

  return {
    from: new Date(startUtcTimestamp),
    to: new Date(endUtcTimestamp)
  };
}

function getBusinessYearRange(date = new Date()) {
  const offsetMinutes = getBusinessUtcOffsetMinutes();
  const localDate = getBusinessLocalDate(date);
  const year = localDate.getUTCFullYear();
  const startUtcTimestamp = Date.UTC(year, 0, 1) - offsetMinutes * MINUTES_IN_MS;
  const endUtcTimestamp = Date.UTC(year + 1, 0, 1) - offsetMinutes * MINUTES_IN_MS;

  return {
    from: new Date(startUtcTimestamp),
    to: new Date(endUtcTimestamp)
  };
}

function getBusinessRollingDaysRange(days, date = new Date()) {
  const today = getBusinessDayRange(date);
  return {
    from: new Date(today.from.getTime() - (days - 1) * DAY_IN_MS),
    to: today.to
  };
}

module.exports = {
  getBusinessDayRange,
  getBusinessMonthRange,
  getBusinessRollingDaysRange,
  getBusinessYearRange
};
