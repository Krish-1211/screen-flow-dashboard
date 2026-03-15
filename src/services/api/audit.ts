import axios from "@/lib/axios";

export interface AuditLogItem {
    id: number;
    user_id: number | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    meta: any;
    created_at: string;
    user_email: string | null;
}

export const auditApi = {
    getAll: async (resourceType?: string, action?: string) => {
        const params = new URLSearchParams();
        if (resourceType) params.append('resource_type', resourceType);
        if (action) params.append('action', action);
        
        const response = await axios.get<AuditLogItem[]>(`/audit/?${params.toString()}`);
        return response.data;
    }
};
