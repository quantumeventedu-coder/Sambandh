// Shared user id for the payment tests' auth mock. Lives in its own module so the
// jest.mock factory (which is hoisted above imports) can require it lazily.
// A plain 24-hex string is a valid id in both engines (pg-odm stores it as-is;
// Mongoose casts it), so this needs no DB library.
const ID = '64b7f9c2e1a4d5f6a7b8c9d0';
module.exports = { userId: () => ID, ID };
