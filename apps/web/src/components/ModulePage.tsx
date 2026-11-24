import type { ReactNode } from "react";

export function ModulePage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="module-page">
      <div className="module-heading">
        <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
        {actions ? <div className="module-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
