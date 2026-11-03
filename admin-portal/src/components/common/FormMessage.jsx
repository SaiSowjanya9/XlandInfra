import { AlertCircle, CheckCircle, X } from 'lucide-react';

// The success/error banner the five portal Add Customer pages set on every submit.
//
// Each page kept the same markup inline, but only in the category-selection branch --
// the property form is a separate early return and rendered nothing, so an error that
// keeps the user on the form had no visible effect at all. The CUSTOMER_EMAIL_EXISTS
// 409 ("This user already exists. Please check with the admin to know more.") was the
// worst of them: the submit button simply went quiet and the refusal was only readable
// in devtools. Render this inside the form, next to the submit button, as well as in
// the surrounding views.
//
// `type="button"` on the dismiss control is not optional: inside a <form> a bare
// <button> submits it, which would re-fire the request the banner is reporting on.
const FormMessage = ({ message, onDismiss, className = '' }) => {
  if (!message?.text) return null;
  const success = message.type === 'success';

  return (
    <div className={`p-4 rounded-lg flex items-center gap-3 ${
      success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
    } ${className}`}>
      {success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
      <span>{message.text}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ml-auto">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default FormMessage;
