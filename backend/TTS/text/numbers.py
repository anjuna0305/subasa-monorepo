import re
from .numbers2wordsSi import converter 

_comma_number_re = re.compile(r'([0-9][0-9\,]+[0-9])')
_decimal_number_re = re.compile(r'([0-9]+\.[0-9]+)')
_rupees_re = re.compile(r'රු.([0-9\.\,]*[0-9]+)')
_pounds_re = re.compile(r'£([0-9\,]*[0-9]+)')
_dollars_re = re.compile(r'\$([0-9\.\,]*[0-9]+)')
_ordinal_re = re.compile(r'[0-9]+(st|nd|rd|th)')
_number_re = re.compile(r'[0-9]+')


def _remove_commas(m):
  return m.group(1).replace(',', '')

# def _expand_decimal_point(m):
#   return m.group(1).replace('.', ' යි දශම ')

def _expand_decimal_point(m):
    """
    Handle Sinhala decimal points and time expressions.
    For times, replace '.' with 'යි' and append 'ට' (e.g., "10.30" -> "දහයි තුන්සේට").
    For other decimals, use the existing logic to replace '.' with ' යි දශම '.
    """
    text = m.group(1)
    
    # Check for time context using regex for HH.MM format
    time_pattern = re.compile(r"(\d{1,2})\.(\d{2})")
    time_match = time_pattern.match(text)

    # Check if the expression is a date-related context (e.g., '10.11.2024' or '10/11/2024')
    date_match = re.match(r"(\d{1,2})[\./](\d{1,2})[\./](\d{4})", text)
    
    if time_match and re.search(r"(පෙ\.ව\.|ප\.ව\.)", text):
        hours = time_match.group(1)
        minutes = time_match.group(2)
        return f"{hours}යි {minutes}"

     # Ensure it is not a time expression by checking absence of 'පෙ.ව.' or 'ප.ව.'
    date_match = re.match(r"(\d{1,2})[\./](\d{1,2})[\./](\d{4})", text)
    if date_match and not re.search(r"(පෙ\.ව\.|ප\.ව\.)", text):
        day = date_match.group(1)
        month = date_match.group(2)
        year = date_match.group(3)

        # Ensure the month is two digits (e.g., '1' becomes '01')
        month = month.zfill(2)  # Zero pad the month if it's a single digit

        # Log the extracted month
        print(f"Extracted month: {month}")  # This should now print if it's matched

        sinhala_months = {
            "01": "ජනවාරි", "02": "පෙබරවාරි", "03": "මාර්තු", "04": "අප්‍රේල්",
            "05": "මැයි", "06": "ජූනි", "07": "ජූලි", "08": "අගෝස්තු",
            "09": "සැප්තැම්බර්", "10": "ඔක්තෝබර්", "11": "නොවැම්බර්", "12": "දෙසැම්බර්"
        }

        month_name = sinhala_months.get(month, "අයවක්")  # Default to "අයවක්" if month is not valid

        return f"{day} {month_name} {year}"


    # elif date_match and not re.search(r"(පෙ\.ව\.|ප\.ව\.)", text):
    #     day = date_match.group(1)
    #     month = date_match.group(2)
    #     year = date_match.group(3)
    #     # Return the date in Sinhala format (e.g., "10 නවම්බර් 2024")
    #     # Ensure the month is two digits (e.g., '1' becomes '01')
    #     month = month.zfill(2)  # Zero pad the month if it's a single digit

    #     # Return the date in Sinhala format (e.g., "10 නවම්බර් 2024")
    #     sinhala_months = {
    #         "01": "ජනවාරි", "02": "පෙබරවාරි", "03": "මාර්තු", "04": "අප්‍රේල්",
    #         "05": "මැයි", "06": "ජූනි", "07": "ජූලි", "08": "අගෝස්තු",
    #         "09": "සැප්තැම්බර්", "10": "ඔක්තෝබර්", "11": "නොවැම්බර්", "12": "දෙසැම්බර්"
    #     }

    #     # Log the month to ensure it's correct
    #     print(f"Extracted month: {month}")

    #     month_name = sinhala_months.get(month, "අයවක්")  # Default to "අයවක්" if month is not valid

    #     return f"{day} {month_name} {year}"

    # Handle regular decimals as 'යි දශම'
    else:
        return text.replace('.', ' යි දශම ')


def _expand_dollars(m):
  match = m.group(1)
  parts = match.split('.')
  if len(parts) > 2:
    return 'ඩොලර් ' + match  # Unexpected format
  dollars = int(parts[0]) if parts[0] else 0
  cents = int(parts[1]) if len(parts) > 1 and parts[1] else 0
  if dollars and cents:
    return '%s %sයි %s %s' % ("ඩොලර්",dollars,"සත",cents)
  elif dollars:
    return '%s %s' % ("ඩොලර්",dollars)
  elif cents:
    return '%s %s' % ("සත",cents)
  else:
    return 'ඩොලර් බිංදුව'


def _expand_rupees(m):
  match = m.group(1)
  parts = match.split('.')
  if len(parts) > 2:
    return "රුපියල්" + match  # Unexpected format
  rupees = int(parts[0]) if parts[0] else 0
  cents = int(parts[1]) if len(parts) > 1 and parts[1] else 0
  default = "යි"
  if rupees and cents:
    rupee_unit = 'රුපියල්'
    cent_unit = 'සත'
    return '%s %s %s %s %s' % (rupee_unit, rupees,default,cent_unit, cents)
  elif rupees:
    rupee_unit = 'රුපියල්'
    return '%s %s' % (rupee_unit,rupees)
  elif cents:
    cent_unit = 'සත' if cents == 1 else 'සත'
    return '%s %s' % (cent_unit,cents)
  else:
    return 'රුපියල් බින්දුව'

def _expand_number(m):
  num = str(m.group(0))
  return converter(num)

def normalize_numbers(text):
  text = re.sub(_comma_number_re, _remove_commas, text)
  text = re.sub(_rupees_re, _expand_rupees, text)
  text = re.sub(_dollars_re, _expand_dollars, text)
  text = re.sub(_pounds_re, r'\1 පවුම්', text)
  text = re.sub(_decimal_number_re, _expand_decimal_point, text)
  text = re.sub(_number_re, _expand_number, text)
  return text
