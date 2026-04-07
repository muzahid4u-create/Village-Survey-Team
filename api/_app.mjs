let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = import("../apps/api/dist/apps/api/src/app.js").then(({ createApp }) => createApp());
  }

  return appPromise;
}

export async function forwardToExpress(req, res) {
  const app = await getApp();
  return app(req, res);
}
