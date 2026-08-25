import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, RefreshCw } from 'lucide-react';

// Get current date in IST timezone
const getISTDate = () => {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + istOffset);
};

// Format date to IST (dd/mm/yyyy)
const formatDateIST = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date)) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parse IST date (dd/mm/yyyy) to yyyy-mm-dd
const parseISTDate = (displayStr) => {
  if (!displayStr || displayStr.length < 10) return null;
  const parts = displayStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Handle IST date input with auto-formatting
const handleISTDateInput = (value) => {
  let cleaned = value.replace(/[^\d/]/g, '');
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
  return cleaned;
};

// Get formatted date string in yyyy-mm-dd format
const getDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DateRangeFilter = ({
  startDate,
  endDate,
  onDateChange,
  onRefresh,
  showRefreshButton = true,
  className = ''
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDateDisplay, setStartDateDisplay] = useState(formatDateIST(startDate));
  const [endDateDisplay, setEndDateDisplay] = useState(formatDateIST(endDate));
  const [tempStartDate, setTempStartDate] = useState(startDate || '');
  const [tempEndDate, setTempEndDate] = useState(endDate || '');
  const datePickerRef = useRef(null);

  // Update display when props change
  useEffect(() => {
    setStartDateDisplay(formatDateIST(startDate));
    setEndDateDisplay(formatDateIST(endDate));
    setTempStartDate(startDate || '');
    setTempEndDate(endDate || '');
  }, [startDate, endDate]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
        // Reset temp values when closing without applying
        setTempStartDate(startDate || '');
        setTempEndDate(endDate || '');
        setStartDateDisplay(formatDateIST(startDate));
        setEndDateDisplay(formatDateIST(endDate));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [startDate, endDate]);

  // Get current IST date
  const now = getISTDate();

  // Quick select handlers (using IST)
  const handleLast7Days = () => {
    const end = getISTDate();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    setTempStartDate(getDateString(start));
    setTempEndDate(getDateString(end));
    setStartDateDisplay(formatDateIST(getDateString(start)));
    setEndDateDisplay(formatDateIST(getDateString(end)));
  };

  const handleLast30Days = () => {
    const end = getISTDate();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    setTempStartDate(getDateString(start));
    setTempEndDate(getDateString(end));
    setStartDateDisplay(formatDateIST(getDateString(start)));
    setEndDateDisplay(formatDateIST(getDateString(end)));
  };

  const handleLast3Months = () => {
    const end = getISTDate();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 3);
    setTempStartDate(getDateString(start));
    setTempEndDate(getDateString(end));
    setStartDateDisplay(formatDateIST(getDateString(start)));
    setEndDateDisplay(formatDateIST(getDateString(end)));
  };

  const handleLastYear = () => {
    const end = getISTDate();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    setTempStartDate(getDateString(start));
    setTempEndDate(getDateString(end));
    setStartDateDisplay(formatDateIST(getDateString(start)));
    setEndDateDisplay(formatDateIST(getDateString(end)));
  };

  const handleClear = () => {
    setTempStartDate('');
    setTempEndDate('');
    setStartDateDisplay('');
    setEndDateDisplay('');
    onDateChange('', '');
    setShowDatePicker(false);
  };

  const handleApply = () => {
    onDateChange(tempStartDate, tempEndDate);
    setShowDatePicker(false);
  };

  // Get display label
  const getDisplayLabel = () => {
    if (startDate && endDate) {
      return `${formatDateIST(startDate)} - ${formatDateIST(endDate)}`;
    }
    return 'All Time';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Date Range Picker Button */}
      <div className="relative" ref={datePickerRef}>
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 shadow-sm"
        >
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-gray-700 font-medium">
            {getDisplayLabel()}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
        </button>
        
        {showDatePicker && (
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4">
            <div className="space-y-4">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={startDateDisplay}
                    onChange={(e) => {
                      const formatted = handleISTDateInput(e.target.value);
                      setStartDateDisplay(formatted);
                      const parsed = parseISTDate(formatted);
                      if (parsed) setTempStartDate(parsed);
                    }}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input 
                      type="date" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={(e) => { 
                        if (e.target.value) { 
                          setTempStartDate(e.target.value); 
                          setStartDateDisplay(formatDateIST(e.target.value)); 
                        }
                      }} 
                    />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={endDateDisplay}
                    onChange={(e) => {
                      const formatted = handleISTDateInput(e.target.value);
                      setEndDateDisplay(formatted);
                      const parsed = parseISTDate(formatted);
                      if (parsed) setTempEndDate(parsed);
                    }}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input 
                      type="date" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={(e) => { 
                        if (e.target.value) { 
                          setTempEndDate(e.target.value); 
                          setEndDateDisplay(formatDateIST(e.target.value)); 
                        }
                      }} 
                    />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleLast7Days}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Last 7 Days
                </button>
                <button
                  onClick={handleLast30Days}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Last 30 Days
                </button>
                <button
                  onClick={handleLast3Months}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Last 3 Months
                </button>
                <button
                  onClick={handleLastYear}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Last Year
                </button>
              </div>

              {/* Clear and Apply Buttons */}
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
                <button
                  onClick={handleApply}
                  className="px-6 py-2 bg-teal-500 text-white text-sm font-medium rounded-lg hover:bg-teal-600 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Refresh Button */}
      {showRefreshButton && onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="font-medium">Refresh</span>
        </button>
      )}
    </div>
  );
};

export default DateRangeFilter;
