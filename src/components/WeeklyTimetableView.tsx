import { TimeTableEntry } from '../types';
import { getCurrentWeekDates, formatTimeSlot, WeekDate } from '../utils/weekUtils';
import { Calendar, Clock, Book, User } from 'lucide-react';

interface WeeklyTimetableViewProps {
  timetable: TimeTableEntry[];
}

interface DayClasses {
  [dayOfWeek: string]: TimeTableEntry[];
}

export default function WeeklyTimetableView({ timetable }: WeeklyTimetableViewProps) {
  const weekDates = getCurrentWeekDates();

  // Group timetable entries by day
  const dayClasses: DayClasses = {};
  timetable.forEach(entry => {
    if (!dayClasses[entry.day]) {
      dayClasses[entry.day] = [];
    }
    dayClasses[entry.day].push(entry);
  });

  // Sort classes by time for each day
  Object.keys(dayClasses).forEach(day => {
    dayClasses[day].sort((a, b) => a.time.localeCompare(b.time));
  });

  const getDayName = (day: string) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[parseInt(day)] || day;
  };

  const getDayColor = (weekDate: WeekDate) => {
    if (weekDate.isToday) return 'border-blue-500 bg-blue-50';
    if (weekDate.isPast) return 'border-gray-300 bg-gray-100';
    return 'border-gray-200 bg-white hover:bg-gray-50';
  };

  const getDayHeaderColor = (weekDate: WeekDate) => {
    if (weekDate.isToday) return 'bg-blue-600 text-white';
    if (weekDate.isPast) return 'bg-gray-400 text-white';
    return 'bg-gray-600 text-white';
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Weekly Timetable
        </h2>
        <p className="text-sm text-gray-500 mt-1">Current week schedule</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {weekDates.map(weekDate => {
            const dayOfWeek = weekDate.dayOfWeek.toString();
            const classes = dayClasses[dayOfWeek] || [];
            
            return (
              <div
                key={dayOfWeek}
                className={`rounded-lg border-2 ${getDayColor(weekDate)} transition-all duration-200`}
              >
                {/* Day Header */}
                <div className={`p-5 rounded-t-lg ${getDayHeaderColor(weekDate)}`}>
                  <div className="text-center">
                    <div className="text-xl font-semibold">{weekDate.dayName}</div>
                    <div className="text-sm opacity-90 mt-1">
                      {weekDate.date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    {weekDate.isToday && (
                      <div className="text-xs mt-2 opacity-75 bg-white bg-opacity-20 rounded-full px-2 py-1 inline-block">Today</div>
                    )}
                  </div>
                </div>

                {/* Classes */}
                <div className="p-5 min-h-[200px]">
                  {classes.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No classes</p>
                      <p className="text-xs text-gray-400 mt-1">Enjoy your free time!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {classes.map((entry, index) => (
                        <div
                          key={entry.id}
                          className={`p-4 rounded-lg border ${
                            weekDate.isPast 
                              ? 'border-gray-200 bg-gray-50' 
                              : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                          } transition-colors`}
                        >
                          <div className="space-y-3">
                            {/* Subject */}
                            <div className="flex items-center space-x-2">
                              <Book className="w-4 h-4 text-blue-600" />
                              <span className="font-semibold text-sm text-gray-900">
                                {entry.subject}
                              </span>
                            </div>

                            {/* Time */}
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                {formatTimeSlot(entry.time)}
                              </span>
                            </div>

                            {/* Faculty */}
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-600 truncate">
                                {entry.facultyName}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Day Summary */}
                {classes.length > 0 && (
                  <div className="px-5 pb-5">
                    <div className="text-xs text-gray-500 text-center bg-gray-50 rounded-lg py-2">
                      {classes.length} class{classes.length !== 1 ? 'es' : ''} scheduled
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
