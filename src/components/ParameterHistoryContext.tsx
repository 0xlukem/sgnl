import { createContext, useContext } from 'react';

export interface ParameterHistoryActions {
  begin: () => void;
  commit: () => void;
  cancel: () => void;
}
const ParameterHistoryContext = createContext<ParameterHistoryActions>({
  begin: () => {}, commit: () => {}, cancel: () => {},
});
export const ParameterHistoryProvider = ParameterHistoryContext.Provider;
export const useParameterHistory = () => useContext(ParameterHistoryContext);
