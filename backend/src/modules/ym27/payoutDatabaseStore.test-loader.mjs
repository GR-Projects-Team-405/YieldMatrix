export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  if (resolved.url.toLowerCase().endsWith('/backend/src/config/db.js')) {
    return {
      url: new URL('./payoutDatabaseStore.test-db-stub.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return resolved;
}
