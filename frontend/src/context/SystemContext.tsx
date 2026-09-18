import React, { createContext, useContext, useState, useEffect } from 'react';
import { onTelemetryUpdate, TelemetryData } from '../services/api';

interface SystemContextType {
  telemetry: TelemetryData | null;
  activeNode: string;
  lastCacheLookup: string | null;
  nodeDistribution: Record<string, number>;
  totalRequests: number;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [activeNode, setActiveNode] = useState<string>('Connecting...');
  const [lastCacheLookup, setLastCacheLookup] = useState<string | null>(null);
  const [nodeDistribution, setNodeDistribution] = useState<Record<string, number>>({});
  const [totalRequests, setTotalRequests] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = onTelemetryUpdate((data) => {
      setTelemetry(data);
      if (data.servedBy) {
        setActiveNode(data.servedBy);
        setNodeDistribution((prev) => ({
          ...prev,
          [data.servedBy!]: (prev[data.servedBy!] || 0) + 1,
        }));
      }
      if (data.cacheLookup) {
        setLastCacheLookup(data.cacheLookup);
      }
      setTotalRequests((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  return (
    <SystemContext.Provider
      value={{
        telemetry,
        activeNode,
        lastCacheLookup,
        nodeDistribution,
        totalRequests,
      }}
    >
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
};
