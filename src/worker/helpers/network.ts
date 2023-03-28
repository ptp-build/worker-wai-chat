import {ENV} from "./env";
export function getCorsHeader(){
  const {Access_Control_Allow_Origin} = ENV
  // const host =
  return {
    'content-type': 'application/json;charset=UTF-8',
    "Access-Control-Allow-Origin":Access_Control_Allow_Origin,
    "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type, Authorization, Accept",
    "Access-Control-Allow-Credentials":"true",
  }
}
export function ResponseJson(result:object,status = 200) {
  return new Response(JSON.stringify(result), {
    status,
    headers: {
      ...getCorsHeader()
    },
  });
}

export function parseQueryFromUrl(urlStr: string): { url: URL; query: Record<string, string> } {
  const replacedUrl = urlStr.replace(/#/g, '?');
  const url = new URL(replacedUrl);
  const query = Array.from(url.searchParams.entries()).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: value
    }),
    {}
  );

  return { url, query };
}
