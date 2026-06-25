import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import clsx from 'clsx';

export default function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
}) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[90vw] max-h-[90vh]',
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className={clsx(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-full',
            sizeClasses[size],
            'bg-discord-surface rounded-lg shadow-2xl',
            'border border-discord-divider',
            'p-0',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            className
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 pb-2">
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-lg font-semibold text-gray-100">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-discord-muted mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-full p-1 text-discord-muted hover:text-gray-100 hover:bg-discord-surface-hover transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-4 py-2 max-h-[60vh] overflow-y-auto">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 px-4 py-3 bg-discord-bg/50 rounded-b-lg border-t border-discord-divider">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}