import { createContext, useContext, useEffect, useState } from "react";
import api from "@/utils/api";

const ReferenceDataContext = createContext({});

export function ReferenceDataProvider({ children }) {
    const [data, setData] = useState({});

    useEffect(() => {
        api.get("/reference-data")
            .then((res) => setData(res.data))
            .catch(() => {});
    }, []);

    return (
        <ReferenceDataContext.Provider value={data}>
            {children}
        </ReferenceDataContext.Provider>
    );
}

export function useReferenceData() {
    return useContext(ReferenceDataContext);
}
