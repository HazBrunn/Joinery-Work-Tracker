// Standard screen frame: sticky header (with optional back + action) + content.
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function Screen({
  title,
  back,
  action,
  children,
}: {
  title: string;
  back?: boolean | (() => void);
  action?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const onBack = () => {
    if (typeof back === 'function') back();
    else navigate(-1);
  };
  return (
    <>
      <header className="app-header">
        {back && (
          <button className="back-btn" onClick={onBack} aria-label="Back" type="button">
            ‹
          </button>
        )}
        <h1>{title}</h1>
        {action}
      </header>
      <div className="content">{children}</div>
    </>
  );
}
