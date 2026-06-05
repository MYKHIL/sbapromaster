import React, { createContext, useContext, ReactNode } from 'react';
import { useUser } from '../context/UserContext';
import { useData } from '../context/DataContext';
import type { UserRole } from '../types';

interface PermissionContextType {
    canEdit: boolean;
    canDelete: boolean;
    canAdd: boolean;
    isReadOnly: boolean;
    userRole: UserRole | null;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

interface ReadOnlyWrapperProps {
    children: ReactNode;
    allowedRoles?: UserRole[];
    requiresAdmin?: boolean;
}

/**
 * Wrapper component that makes content read-only for non-authorized users
 * Disables form inputs, hides add/edit/delete buttons
 */
const ReadOnlyWrapper: React.FC<ReadOnlyWrapperProps> = ({
    children,
    allowedRoles = ['Admin'],
    requiresAdmin = false
}) => {
    const { settings } = useData();
    const { currentUser, isAuthenticated } = useUser();

    const isLocked = Boolean(settings?.isDataEntryLocked);
    const isUserReadOnly = currentUser?.isReadOnly || false;

    const hasRolePermission = isAuthenticated && currentUser && (
        currentUser.role === 'Admin' || allowedRoles.includes(currentUser.role)
    ) && (requiresAdmin ? currentUser.role === 'Admin' : true);

    const canEditValue: boolean = (hasRolePermission && !isUserReadOnly && (!isLocked || (currentUser && currentUser.role === 'Admin'))) || false;

    const permissionValue = {
        canEdit: canEditValue,
        canDelete: canEditValue,
        canAdd: canEditValue as boolean,
        isReadOnly: (!canEditValue) as boolean,
        userRole: (currentUser?.role || null) as UserRole | null,
    } as PermissionContextType;

    const wrapperContent = (
        <PermissionContext.Provider value={permissionValue}>
            {canEditValue ? (
                <div className="w-full">{children}</div>
            ) : (
                <fieldset
                    disabled={true}
                    className="read-only-mode w-full border-none p-0 m-0 min-w-0 block"
                    style={{ inheritParams: 'none' } as any}
                >
                    {children}
                </fieldset>
            )}
        </PermissionContext.Provider>
    );

    return wrapperContent;
};

/**
 * Hook to access permission context
 */
export const usePermissions = () => {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        // Return default read-only permissions if not within a wrapper
        return {
            canEdit: false,
            canDelete: false,
            canAdd: false,
            isReadOnly: true,
            userRole: null,
        };
    }
    return context;
};

/**
 * Component to conditionally render children based on permissions
 */
export const PermissionGuard: React.FC<{
    children: ReactNode;
    requires: 'edit' | 'delete' | 'add';
    fallback?: ReactNode;
}> = ({ children, requires, fallback = null }) => {
    const permissions = usePermissions();

    const hasPermission =
        requires === 'edit' ? permissions.canEdit :
            requires === 'delete' ? permissions.canDelete :
                requires === 'add' ? permissions.canAdd :
                    false;

    return hasPermission ? <>{children}</> : <>{fallback}</>;
};

/**
 * HOC to wrap a button/interactive element with permission checking
 */
export const withPermission = <P extends object>(
    Component: React.ComponentType<P>,
    requiredPermission: 'edit' | 'delete' | 'add'
) => {
    return (props: P) => {
        const permissions = usePermissions();
        const hasPermission =
            requiredPermission === 'edit' ? permissions.canEdit :
                requiredPermission === 'delete' ? permissions.canDelete :
                    requiredPermission === 'add' ? permissions.canAdd :
                        false;

        if (!hasPermission) {
            return null;
        }

        return <Component {...props} />;
    };
};

export default ReadOnlyWrapper;
