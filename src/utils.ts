export function getConfiguration(key: string) {
  return { port: 4000 }[key];
}
