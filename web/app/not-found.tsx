import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <span className="eyebrow">404</span>
      <h1>This page isn’t in the workspace.</h1>
      <p>Return to your samples to continue exploring.</p>
      <Link href="/samples" className="button">
        Open sample library
      </Link>
    </div>
  );
}
