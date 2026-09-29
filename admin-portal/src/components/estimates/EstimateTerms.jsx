import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { DEFAULT_ESTIMATE_TERMS_TEXT, estimateTermsLines } from '../../utils/estimateTerms';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';

/**
 * Terms & Conditions on an estimate.
 *
 * `TermsConditionsField` is the create-form control: a checkbox, on for a new estimate, and the
 * clauses it will attach. The text is editable, so what the creator reads here is exactly what
 * the estimate stores and the PDF prints.
 *
 * `editable={false}` is the same card without the choice: the standard clauses, shown so the
 * creator knows what the customer will read, with no checkbox and no textarea. Writing terms
 * belongs to Admin, Operations Manager and FP, so Manager, Coordinator, Supervisor and Executive
 * pass it. Hiding the controls is not what enforces that - `backend/utils/estimateTerms.js`
 * ignores terms sent by a role that may not author them.
 *
 * `EstimateTermsSection` is the read-only half for view modals. Both render the clauses through
 * the same helper as the PDF, so a modal and its export never disagree.
 */

export function TermsConditionsField({ include, onIncludeChange, terms, onTermsChange, className = '', theme, editable = true }) {
  const [open, setOpen] = useState(false);
  const lines = estimateTermsLines({ includeTerms: include, termsConditions: terms });
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);

  return (
    <div className={`rounded-xl border ${skin.panel} ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {editable ? (
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={!!include}
              onChange={(e) => onIncludeChange(e.target.checked)}
              className={`h-4 w-4 ${skin.control}`}
            />
            <span className={`flex items-center gap-2 text-sm font-medium ${skin.heading}`}>
              <FileText className={`h-4 w-4 ${skin.faint}`} />
              Include Terms &amp; Conditions
            </span>
          </label>
        ) : (
          <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium ${skin.heading}`}>
            <FileText className={`h-4 w-4 ${skin.faint}`} />
            Terms &amp; Conditions
            <span className={`text-xs font-normal ${skin.faint}`}>Standard clauses, included on this estimate</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className={`flex items-center gap-1 text-xs font-medium ${skin.link}`}
        >
          {open ? 'Hide' : 'Preview'}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open && (
        <div className={`border-t px-4 py-3 ${skin.borderSoft}`}>
          {include ? (
            <>
              <ol className={`mb-3 list-decimal space-y-1.5 pl-5 text-xs ${skin.muted}`}>
                {lines.map((line, index) => <li key={index}>{line}</li>)}
              </ol>
              {editable ? (
                <>
                  <textarea
                    value={terms}
                    onChange={(e) => onTermsChange(e.target.value)}
                    rows={6}
                    placeholder="One clause per line"
                    className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 ${skin.field}`}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className={`text-xs ${skin.faint}`}>One clause per line. These terms print on the estimate PDF.</p>
                    {terms !== DEFAULT_ESTIMATE_TERMS_TEXT && (
                      <button type="button" onClick={() => onTermsChange(DEFAULT_ESTIMATE_TERMS_TEXT)}
                        className={`text-xs font-medium ${skin.link}`}>Reset to default</button>
                    )}
                  </div>
                </>
              ) : (
                <p className={`text-xs ${skin.faint}`}>These terms print on the estimate PDF.</p>
              )}
            </>
          ) : (
            <p className={`text-xs ${skin.muted}`}>This estimate will be sent without Terms &amp; Conditions.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function EstimateTermsSection({ estimate, className = '' }) {
  const lines = estimateTermsLines(estimate);
  if (!lines.length) return null;

  return (
    <div className={className}>
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Terms &amp; Conditions</h4>
      <ol className="list-decimal space-y-1 rounded-lg border border-gray-200 bg-gray-50 py-3 pl-8 pr-4 text-xs text-gray-600">
        {lines.map((line, index) => <li key={index}>{line}</li>)}
      </ol>
    </div>
  );
}

export default TermsConditionsField;
