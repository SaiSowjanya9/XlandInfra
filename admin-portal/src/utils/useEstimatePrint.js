import { useEffect } from 'react';
import { printEstimatePDF } from './pdfExport';

// While an estimate document is open, Ctrl+P / Cmd+P prints the generated PDF rather than the
// page: the browser's own print stamps the tab title and URL on every sheet -- chrome no
// stylesheet can remove -- while a document printed from the PDF viewer carries the estimate
// alone. `prepare` maps a portal's stored row to the PDF's data where the raw estimate needs
// it. Falls back to a plain print if the document cannot be built.
export const useEstimatePrint = (estimate, prepare) => {
  useEffect(() => {
    if (!estimate) return undefined;
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'p') {
        event.preventDefault();
        if (!printEstimatePDF(prepare ? prepare(estimate) : estimate)) window.print();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
};
