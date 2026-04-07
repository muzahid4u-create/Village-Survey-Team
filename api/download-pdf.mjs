import { forwardToExpress } from "./_app.mjs";

export default async function handler(req, res) {
  return forwardToExpress(req, res);
}
