import {getAssetFromKV} from "@cloudflare/kv-asset-handler";
const DEBUG = false;

export default async function (event:FetchEvent){
  let options:{cacheControl:any} = {
    cacheControl: undefined
  };

  try {
    if (DEBUG) {
      // customize caching
      options.cacheControl = {
        bypassCache: true,
      };
    }
    const page = await getAssetFromKV(event, options);
    // allow headers to be altered
    const response = new Response(page.body, page);
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'unsafe-url');
    response.headers.set('Feature-Policy', 'none');
    return response;
  } catch (e) {
    // if an error is thrown try to serve the asset at 404.html
    if (!DEBUG) {
      try {
        let notFoundResponse = await getAssetFromKV(event, {
          // @ts-ignore
          mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/404.html`, req),
        });

        return new Response(notFoundResponse.body, {
          ...notFoundResponse,
          status: 404,
        });
      } catch (e) {}
    }
    // @ts-ignore
    return new Response(e.message || e.toString(), { status: 500 });

  }
}
