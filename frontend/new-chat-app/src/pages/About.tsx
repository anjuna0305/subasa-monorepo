import { useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { isOrgAdmin } from "@/utils/auth";

export default function AboutPage() {
  const [count, setCount] = useState(0);

  return (
    <AuthGuard roleValidators={[isOrgAdmin]}>
      <div>
        <div>this is the count : {count}</div>
        <button onClick={() => setCount(count + 1)}>increase</button>
        <button onClick={() => setCount(count - 1)}>decrease</button>
        <button onClick={() => setCount(count / 2)}>divide by two</button>
        <button onClick={() => setCount(count * 2)}>multiply by two</button>
        this is the about page.
      </div>
    </AuthGuard>
  );
}