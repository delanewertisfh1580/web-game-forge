/**
 * Deep merge utility. Arrays are replaced, not merged.
 * Objects are merged recursively. Primitives are overwritten.
 */
export function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (Array.isArray(srcVal)) {
      // Arrays are replaced entirely
      output[key] = srcVal;
    } else if (srcVal !== null && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
      if (tgtVal !== null && typeof tgtVal === 'object' && !Array.isArray(tgtVal)) {
        output[key] = deepMerge(tgtVal, srcVal);
      } else {
        output[key] = { ...srcVal };
      }
    } else {
      output[key] = srcVal;
    }
  }
  return output;
}
