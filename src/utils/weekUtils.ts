// Utility functions for week-based timetable management

export interface WeekDate {
  date: Date;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  dayName: string;
  isToday: boolean;
  isPast: boolean;
}

export const getCurrentWeekDates = (): WeekDate[] => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDay); // Start from Sunday
  
  const weekDates: WeekDate[] = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    
    const isToday = date.toDateString() === today.toDateString();
    const isPast = date < today && !isToday;
    
    weekDates.push({
      date,
      dayOfWeek: i,
      dayName: dayNames[i],
      isToday,
      isPast
    });
  }
  
  return weekDates;
};

export const formatTimeSlot = (time: string): string => {
  // Handle time range format (e.g., "08:00 - 09:00")
  if (time.includes(' - ')) {
    const [startTime, endTime] = time.split(' - ');
    return `${formatSingleTime(startTime)} - ${formatSingleTime(endTime)}`;
  }
  return formatSingleTime(time);
};

export const formatSingleTime = (time: string): string => {
  // Convert 24-hour format to 12-hour format for display
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const getTimeSlots = (): string[] => {
  // Generate common time slots from 8 AM to 6 PM
  const slots: string[] = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
};

export const getTimeOptions = (): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push({
        value: timeString,
        label: formatSingleTime(timeString)
      });
    }
  }
  return options;
};

export const isTimeSlotInPast = (date: Date, time: string): boolean => {
  const now = new Date();
  
  // Handle time range format
  if (time.includes(' - ')) {
    const [startTime] = time.split(' - ');
    const [hours, minutes] = startTime.split(':');
    const slotDateTime = new Date(date);
    slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return slotDateTime < now;
  }
  
  // Handle single time format
  const [hours, minutes] = time.split(':');
  const slotDateTime = new Date(date);
  slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  return slotDateTime < now;
};

export const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':');
  return parseInt(hours) * 60 + parseInt(minutes);
};

export const checkTimeOverlap = (time1: string, time2: string): boolean => {
  // Parse time ranges
  const parseTimeRange = (timeStr: string) => {
    if (timeStr.includes(' - ')) {
      const [start, end] = timeStr.split(' - ');
      return {
        start: parseTimeToMinutes(start),
        end: parseTimeToMinutes(end)
      };
    } else {
      // If single time, assume 1-hour duration
      const start = parseTimeToMinutes(timeStr);
      return {
        start,
        end: start + 60
      };
    }
  };

  const range1 = parseTimeRange(time1);
  const range2 = parseTimeRange(time2);

  // Check for overlap: range1.start < range2.end && range2.start < range1.end
  return range1.start < range2.end && range2.start < range1.end;
};

export const validateTimeRange = (timeStr: string): { isValid: boolean; error?: string } => {
  if (!timeStr.includes(' - ')) {
    return { isValid: false, error: 'Time must be in format "HH:MM - HH:MM"' };
  }

  const [startTime, endTime] = timeStr.split(' - ');
  
  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (!timeRegex.test(startTime.trim()) || !timeRegex.test(endTime.trim())) {
    return { isValid: false, error: 'Invalid time format. Use HH:MM format (e.g., 09:30)' };
  }

  // Check if start time is before end time
  const startMinutes = parseTimeToMinutes(startTime.trim());
  const endMinutes = parseTimeToMinutes(endTime.trim());
  
  if (startMinutes >= endMinutes) {
    return { isValid: false, error: 'Start time must be before end time' };
  }

  return { isValid: true };
};
