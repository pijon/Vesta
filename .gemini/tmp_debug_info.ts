
export const getLocalStorageDebugInfo = () => {
    const keys = [
        "fast800_recipes",
        "fast800_plan",
        "fast800_stats",
        "fast800_enhanced_shopping",
        "fast800_pantry",
        "fast800_logs",
        "fast800_fasting_state",
        "fast800_fasting_history"
    ];

    const info: Record<string, number | string> = {};

    keys.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    info[key] = parsed.length;
                } else if (typeof parsed === 'object') {
                    info[key] = Object.keys(parsed).length;
                } else {
                    info[key] = "Found (Unknown Type)";
                }
            } catch (e) {
                info[key] = "Error parsing JSON";
            }
        } else {
            info[key] = "Not Found";
        }
    });

    return info;
};
