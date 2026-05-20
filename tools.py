"""
Free API tools for Lauki Phones agent.
All APIs require no API key.
"""
import requests
from langchain_core.tools import tool


@tool
def get_weather_network_impact(city: str) -> str:
    """Check current weather in a city that may be affecting network quality.
    Use when user reports signal issues, slow speeds, or connectivity problems.

    Args:
        city: City name (e.g., 'Mumbai', 'Delhi', 'Dubai')
    """
    try:
        # Get coordinates first
        geo = requests.get(
            f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1",
            timeout=5
        ).json()
        if not geo.get("results"):
            return f"Could not find location: {city}"

        r = geo["results"][0]
        lat, lon, name = r["latitude"], r["longitude"], r["name"]

        weather = requests.get(
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,precipitation,weathercode,windspeed_10m",
            timeout=5
        ).json()["current"]

        code = weather["weathercode"]
        rain = weather["precipitation"]
        wind = weather["windspeed_10m"]
        temp = weather["temperature_2m"]

        # WMO weather codes: 51-67 = rain, 71-77 = snow, 80-99 = storms
        impact = "minimal"
        if 51 <= code <= 67 or 80 <= code <= 82:
            impact = "moderate — rain can degrade outdoor signal"
        elif 83 <= code <= 99:
            impact = "HIGH — storms may cause significant network disruption"
        elif 71 <= code <= 77:
            impact = "moderate — snow/ice can affect tower equipment"

        return (
            f"Weather in {name}: {temp}°C, precipitation {rain}mm, wind {wind}km/h. "
            f"Network impact: {impact}."
        )
    except Exception as e:
        return f"Weather check unavailable: {str(e)}"


@tool
def get_country_info(country_name: str) -> str:
    """Get country details relevant to telecom services: dial code, currency, region, timezone.
    Use when user mentions a country for roaming, porting, or international calls.

    Args:
        country_name: Country name (e.g., 'UAE', 'United Kingdom', 'Singapore')
    """
    try:
        r = requests.get(
            f"https://restcountries.com/v3.1/name/{country_name}?fields=name,idd,currencies,region,timezones,flags",
            timeout=5
        ).json()
        if not r or isinstance(r, dict):
            return f"Country not found: {country_name}"

        c = r[0]
        name = c["name"]["common"]
        region = c.get("region", "Unknown")
        timezones = ", ".join(c.get("timezones", [])[:2])
        dial = c.get("idd", {})
        dial_code = (dial.get("root", "") + (dial.get("suffixes", [""])[0] if dial.get("suffixes") else "")) or "N/A"
        currencies = ", ".join(
            f"{v['name']} ({k})" for k, v in c.get("currencies", {}).items()
        ) or "N/A"

        return (
            f"{name} | Region: {region} | Dial code: {dial_code} | "
            f"Currency: {currencies} | Timezones: {timezones}"
        )
    except Exception as e:
        return f"Country info unavailable: {str(e)}"


@tool
def validate_phone_number(phone_number: str, country_code: str = "IN") -> str:
    """Validate a phone number format for porting requests or account verification.
    Use before processing porting requests or when user provides a number to verify.

    Args:
        phone_number: Phone number to validate (e.g., '+919876543210')
        country_code: ISO country code (default: IN for India)
    """
    try:
        r = requests.get(
            f"https://phonevalidation.abstractapi.com/v1/?api_key=free&phone={phone_number}",
            timeout=5
        ).json()
        # Abstract API free tier — fallback to basic format check if unavailable
        if "valid" in r:
            valid = r["valid"]
            fmt = r.get("format", {}).get("international", phone_number)
            carrier = r.get("carrier", "Unknown carrier")
            line_type = r.get("type", "unknown")
            return f"Number {fmt}: {'Valid' if valid else 'Invalid'} | Carrier: {carrier} | Type: {line_type}"
    except Exception:
        pass

    # Fallback: basic format validation
    digits = "".join(c for c in phone_number if c.isdigit())
    if len(digits) >= 10:
        return f"Number {phone_number}: Format appears valid ({len(digits)} digits). Carrier lookup unavailable."
    return f"Number {phone_number}: Invalid format — too few digits."


@tool
def check_public_holidays(country_code: str, year: int = 2026) -> str:
    """Check upcoming public holidays in a country that may affect support SLA or billing cycles.
    Use when user asks about support availability, billing delays, or SLA timelines.

    Args:
        country_code: ISO 2-letter country code (e.g., 'IN', 'AE', 'GB', 'US')
        year: Year to check (default: 2026)
    """
    try:
        from datetime import date
        r = requests.get(
            f"https://date.nager.at/api/v3/PublicHolidays/{year}/{country_code.upper()}",
            timeout=5
        ).json()
        if not r or isinstance(r, dict):
            return f"No holiday data found for country code: {country_code}"

        today = date.today()
        upcoming = [h for h in r if h["date"] >= str(today)][:3]

        if not upcoming:
            return f"No upcoming public holidays in {country_code} for {year}."

        lines = [f"- {h['date']}: {h['name']}" for h in upcoming]
        return f"Upcoming holidays in {country_code}:\n" + "\n".join(lines) + \
               "\nNote: Support SLAs may be extended on these dates."
    except Exception as e:
        return f"Holiday check unavailable: {str(e)}"
