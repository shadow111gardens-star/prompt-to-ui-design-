// Focused rendering/generation/persistence tests supply an already-authorized
// synthetic server identity, as they previously supplied a Prisma stub. Access
// enforcement itself is exercised without this stub in project-ownership.test.cjs.
module.exports = {
  withProjectRoute: handler => handler,
  withVerifiedIdentity: (_identity, work) => work(),
  serverIdentity: async () => ({ sub: 'feature-test-owner', plan: 'local' }),
  ownerFilter: async () => ({ ownerUid: 'feature-test-owner' }),
  ownedProjectWhere: async id => ({ id, ownerUid: 'feature-test-owner' }),
  requireOwnedProject: async id => ({ id, ownerUid: 'feature-test-owner' }),
  projectAccessResponse: () => undefined,
  ProjectAccessError: class extends Error {},
};
