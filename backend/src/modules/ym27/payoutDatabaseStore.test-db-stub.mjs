function rejectUnexpectedUse() {
  throw new Error('The shared database module is unavailable in YM27 integration tests');
}

export default Object.freeze({
  query: rejectUnexpectedUse,
  connect: rejectUnexpectedUse,
  end: rejectUnexpectedUse,
});
