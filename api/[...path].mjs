let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = import("../apps/api/dist/apps/api/src/app.js").then(({ createApp }) => createApp());
  }

  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
