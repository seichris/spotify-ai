export const getSafeLoginRedirect = (redirectTo: unknown) => {
  if (
    typeof redirectTo !== "string" ||
    !redirectTo.startsWith("/") ||
    redirectTo.startsWith("//") ||
    redirectTo.includes("\\")
  ) {
    return "/";
  }

  return redirectTo;
};
