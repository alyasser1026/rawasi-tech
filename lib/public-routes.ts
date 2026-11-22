export const isPublicRoute = (path?: string | null): boolean => {
  if (!path) return false;
  return (
    path === '/' ||
    path === '/login' ||
    path === '/signup' ||
    path === '/website' ||
    path.startsWith('/website/') ||
    path === '/sections' ||
    path.startsWith('/sections/') ||
    path === '/store' ||
    path.startsWith('/store/') ||
    path === '/real-estate' ||
    path.startsWith('/real-estate/') ||
    path === '/verify' ||
    path.startsWith('/verify') ||
    path.startsWith('/construct')
  );
};
