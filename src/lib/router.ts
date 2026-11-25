import { useEffect, useState } from "react";

export type Route =
  | { name: "overview" }
  | { name: "week" }
  | { name: "payouts" }
  | { name: "archive"; id?: string }
  | { name: "employees"; id?: string }
  | { name: "settings"; tab?: string };

export function parse(hash: string): Route {
  const [name, arg] = hash.replace(/^#\/?/, "").split("/");
  switch (name) {
    case "week":
      return { name: "week" };
    case "payouts":
      return { name: "payouts" };
    case "archive":
      return { name: "archive", id: arg };
    case "employees":
      return { name: "employees", id: arg };
    case "settings":
      return { name: "settings", tab: arg };
    default:
      return { name: "overview" };
  }
}

export function href(r: Route): string {
  const arg = "id" in r && r.id ? "/" + r.id : "tab" in r && r.tab ? "/" + r.tab : "";
  return "#/" + r.name + arg;
}

export function go(r: Route) {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const h = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return route;
}
