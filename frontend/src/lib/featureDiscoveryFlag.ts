export function isFeatureDiscoveryEnabled(value: unknown = import.meta.env.VITE_FEATURE_DISCOVERY_ENABLED) {
  return value === 'true'
}
