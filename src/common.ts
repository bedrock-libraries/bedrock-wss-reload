export function getOrThrowFromProcess<T = string>(
  key: string,
  messageOverride?: string
): T {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      messageOverride ??
        `Missing environment variable ${key}. Make sure to configure project.`
    );
  }

  return value as T;
}
