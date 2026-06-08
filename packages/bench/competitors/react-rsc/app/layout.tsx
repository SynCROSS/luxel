export default function Layout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head><meta charSet="utf-8" /><title>Luxel</title></head><body><main>{children}</main></body></html>);
}