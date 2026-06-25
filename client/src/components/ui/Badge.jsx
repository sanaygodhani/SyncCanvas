import clsx from 'clsx';

const variants = {
  default: 'bg-blurple text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-yellow-600 text-white',
  danger: 'bg-red-600 text-white',
  muted: 'bg-discord-surface text-discord-muted',
  unread: 'bg-red-500 text-white',
};

const sizes = {
  sm: 'text-[10px] px-1.5 py-0.5 min-w-[16px]',
  md: 'text-xs px-2 py-0.5 min-w-[20px]',
  lg: 'text-sm px-3 py-1 min-w-[24px]',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
  dot,
  ...props
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center font-semibold rounded-full leading-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
      )}
      {children}
    </span>
  );
}