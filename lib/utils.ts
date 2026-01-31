export function isNumberInString(value: any) {
  try {
    const num = Number(value);
    return !Number.isNaN(num) && typeof num === "number";
  } catch {
    return false;
  }
}
