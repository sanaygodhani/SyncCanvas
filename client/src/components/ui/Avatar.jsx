import * as AvatarPrimitive from '@radix-ui/react-avatar';
import clsx from 'clsx';

export default function Avatar({
  src,
  name,
  size = 'md',
  status,
  className,
  ...props
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  };

  const statusColors = {
    online: 'bg-green-500',
    idle: 'bg-yellow-500',
    dnd: 'bg-red-500',
    offline: 'bg-gray-500',
  };

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className={clsx('relative inline-flex shrink-0', className)}>
      <AvatarPrimitive.Root
        className={clsx(
          'rounded-full overflow-hidden bg-discord-surface flex items-center justify-center select-none',
          sizeClasses[size]
        )}
        {...props}
      >
        <AvatarPrimitive.Image
          src={src}
          alt={name || 'User avatar'}
          className="w-full h-full object-cover"
        />
        <AvatarPrimitive.Fallback
          className="w-full h-full flex items-center justify-center font-medium text-discord-muted"
          delayMs={600}
        >
          {initials}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {status && (
        <span
          className={clsx(
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-discord-sidebar',
            statusColors[status] || statusColors.offline
          )}
        />
      )}
    </div>
  );
}