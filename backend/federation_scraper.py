"""
Federation Calendar Scraper
Scraper per importare calendari dalle federazioni sportive (FIPAV, FIP)
"""

import httpx
from bs4 import BeautifulSoup
from datetime import datetime
import re
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class ScrapedMatch:
    """Match scraped from federation website"""
    match_number: str
    date: datetime
    home_team: str
    away_team: str
    venue: Optional[str] = None
    result: Optional[str] = None
    championship: Optional[str] = None
    giornata: Optional[str] = None


class FIPAVScraper:
    """Scraper for FIPAV (Federazione Italiana Pallavolo) websites"""
    
    BASE_URL = "http://{region}.portalefipav.net/risultati-classifiche.aspx"
    
    # Region codes and their ComitatoId
    REGIONS = {
        "umbria": {"id": "umbria", "comitato_id": "30"},
        "lazio": {"id": "lazio", "comitato_id": "12"},
        "toscana": {"id": "toscana", "comitato_id": "29"},
        "emilia": {"id": "emilia", "comitato_id": "8"},
        "lombardia": {"id": "lombardia", "comitato_id": "14"},
        "piemonte": {"id": "piemonte", "comitato_id": "21"},
        "veneto": {"id": "veneto", "comitato_id": "32"},
        "marche": {"id": "marche", "comitato_id": "16"},
        "abruzzo": {"id": "abruzzo", "comitato_id": "1"},
        "campania": {"id": "campania", "comitato_id": "5"},
        "puglia": {"id": "puglia", "comitato_id": "24"},
        "calabria": {"id": "calabria", "comitato_id": "4"},
        "sicilia": {"id": "sicilia", "comitato_id": "27"},
        "sardegna": {"id": "sardegna", "comitato_id": "26"},
        "liguria": {"id": "liguria", "comitato_id": "13"},
        "friuli": {"id": "friuli", "comitato_id": "10"},
        "trentino": {"id": "trentino", "comitato_id": "28"},
    }
    
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    def __init__(self, region: str = "umbria"):
        self.region = region.lower()
        self.base_url = self.BASE_URL.format(region=self.region)
        region_data = self.REGIONS.get(self.region, {"comitato_id": "30"})
        self.comitato_id = region_data.get("comitato_id", "30")
    
    async def get_seasons(self) -> List[Dict]:
        """Get available seasons from the dropdown"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(self.base_url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            seasons = []
            season_select = soup.find('select', {'id': lambda x: x and 'StagioneSportiva' in str(x)})
            if season_select:
                for option in season_select.find_all('option'):
                    value = option.get('value', '')
                    text = option.get_text(strip=True)
                    if value:
                        seasons.append({'id': value, 'name': text})
            
            return seasons
    
    async def get_championships(self, season_id: Optional[str] = None) -> List[Dict]:
        """Get available championships for a season"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {}
            if season_id:
                params['StId'] = season_id
            
            response = await client.get(self.base_url, params=params)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            championships = []
            champ_select = soup.find('select', {'id': lambda x: x and 'Campionato' in str(x)})
            if champ_select:
                for option in champ_select.find_all('option'):
                    value = option.get('value', '')
                    text = option.get_text(strip=True)
                    if value and 'Tutti' not in text:
                        championships.append({'id': value, 'name': text})
            
            return championships
    
    async def get_societies(self, season_id: Optional[str] = None) -> List[Dict]:
        """Get available societies/teams for a season"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {}
            if season_id:
                params['StId'] = season_id
            
            response = await client.get(self.base_url, params=params)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            societies = []
            society_select = soup.find('select', {'id': lambda x: x and 'Societa' in str(x)})
            if society_select:
                for option in society_select.find_all('option'):
                    value = option.get('value', '')
                    text = option.get_text(strip=True)
                    if value and 'Tutte' not in text:
                        societies.append({'id': value, 'name': text})
            
            return societies
    
    async def scrape_matches(
        self,
        society_id: Optional[str] = None,
        championship_id: Optional[str] = None,
        season_id: Optional[str] = None,
        society_name: Optional[str] = None
    ) -> List[ScrapedMatch]:
        """
        Scrape matches from FIPAV portal
        
        Args:
            society_id: Filter by society ID
            championship_id: Filter by championship ID (CId parameter)
            season_id: Season ID (StId parameter)
            society_name: Name of society to match (for filtering results)
        """
        matches = []
        
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            # Build URL with parameters
            params = {}
            if season_id:
                params['StId'] = season_id
            if championship_id:
                params['CId'] = championship_id
            if society_id:
                params['SId'] = society_id
            
            logging.info(f"Scraping FIPAV: {self.base_url} with params {params}")
            
            response = await client.get(self.base_url, params=params)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all match tables
            tables = soup.find_all('table')
            
            current_championship = None
            
            for table in tables:
                # Check if there's a championship header before this table
                prev = table.find_previous(['h3', 'h4', 'strong', 'b'])
                if prev:
                    champ_text = prev.get_text(strip=True)
                    if 'Girone' in champ_text or 'Serie' in champ_text or 'Under' in champ_text or 'Divisione' in champ_text:
                        current_championship = champ_text
                
                # Find rows in the table
                rows = table.find_all('tr')
                
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) < 5:
                        continue
                    
                    # Try to extract match data
                    try:
                        match_data = self._parse_match_row(cells, current_championship)
                        if match_data:
                            # Filter by society name if provided
                            if society_name:
                                society_name_lower = society_name.lower()
                                if (society_name_lower not in match_data.home_team.lower() and 
                                    society_name_lower not in match_data.away_team.lower()):
                                    continue
                            
                            matches.append(match_data)
                    except Exception as e:
                        logging.debug(f"Error parsing row: {e}")
                        continue
        
        logging.info(f"Scraped {len(matches)} matches from FIPAV")
        return matches
    
    def _parse_match_row(self, cells: list, championship: Optional[str]) -> Optional[ScrapedMatch]:
        """Parse a table row to extract match data"""
        # FIPAV table structure varies, but typically:
        # | Gara | G | Data/ora | Squadra casa | Squadra ospite | Risul. | ...
        
        cell_texts = [cell.get_text(strip=True) for cell in cells]
        
        # Look for date pattern (DD/MM/YY HH:MM)
        date_pattern = r'(\d{2}/\d{2}/\d{2})\s*(\d{2}:\d{2})?'
        date_cell_idx = None
        match_date = None
        
        for i, text in enumerate(cell_texts):
            date_match = re.search(date_pattern, text)
            if date_match:
                date_cell_idx = i
                try:
                    date_str = date_match.group(1)
                    time_str = date_match.group(2) or "00:00"
                    match_date = datetime.strptime(f"{date_str} {time_str}", "%d/%m/%y %H:%M")
                except:
                    continue
                break
        
        if not match_date or date_cell_idx is None:
            return None
        
        # Extract match number (usually first column or in the cells)
        match_number = None
        for text in cell_texts[:3]:
            num_match = re.search(r'^\d+$', text)
            if num_match:
                match_number = text
                break
        
        # Extract teams - look for cells with team names (usually contain images or specific formatting)
        teams = []
        for cell in cells:
            # Look for team name near images or in specific cell structure
            imgs = cell.find_all('img')
            cell_text = cell.get_text(strip=True)
            
            # Skip cells that are just numbers, dates, or results
            if re.match(r'^[\d\-\/:\s]+$', cell_text) or len(cell_text) < 3:
                continue
            
            # Skip result cells (like "3-1", "0-3")
            if re.match(r'^\d+\s*-\s*\d+$', cell_text):
                continue
            
            # This might be a team name
            if len(cell_text) > 3 and not cell_text.startswith('20'):
                # Clean up team name
                team_name = re.sub(r'\s+', ' ', cell_text).strip()
                # Remove logo file names that might be included
                team_name = re.sub(r'Logo\w+\.[\w]+', '', team_name).strip()
                if team_name and len(team_name) > 2:
                    teams.append(team_name)
        
        # We need at least 2 teams
        if len(teams) < 2:
            return None
        
        # Usually the order is: home team, away team
        home_team = teams[0] if teams else "Unknown"
        away_team = teams[1] if len(teams) > 1 else "Unknown"
        
        # Extract result if present
        result = None
        for text in cell_texts:
            result_match = re.match(r'^(\d+)\s*-\s*(\d+)$', text)
            if result_match:
                result = f"{result_match.group(1)}-{result_match.group(2)}"
                break
        
        # Extract giornata (matchday)
        giornata = None
        for i, text in enumerate(cell_texts):
            if i < 3 and text.isdigit() and text != match_number:
                giornata = text
                break
        
        return ScrapedMatch(
            match_number=match_number or f"FIPAV-{match_date.strftime('%Y%m%d%H%M')}",
            date=match_date,
            home_team=home_team,
            away_team=away_team,
            result=result,
            championship=championship,
            giornata=giornata
        )


class FIPScraper:
    """Scraper for FIP (Federazione Italiana Pallacanestro) websites"""
    
    BASE_URL = "https://{region}.fip.it"
    
    REGIONS = {
        "umbria": "umbria",
        "lazio": "lazio",
        "toscana": "toscana",
        "emilia": "emilia",
        "lombardia": "lombardia",
        # Add more regions as needed
    }
    
    def __init__(self, region: str = "umbria"):
        self.region = region.lower()
        self.base_url = self.BASE_URL.format(region=self.region)
    
    async def scrape_matches(self, pdf_url: Optional[str] = None) -> List[ScrapedMatch]:
        """
        FIP typically uses PDFs for calendars, which is harder to parse.
        This is a placeholder for future implementation.
        """
        # FIP uses mostly PDFs, which would require additional parsing
        # For now, return empty list
        logging.warning("FIP scraper not fully implemented - FIP uses PDF calendars")
        return []


async def test_fipav_scraper():
    """Test function to verify FIPAV scraper works"""
    scraper = FIPAVScraper(region="umbria")
    
    print("Testing FIPAV Umbria scraper...")
    
    # Get seasons
    seasons = await scraper.get_seasons()
    print(f"Found {len(seasons)} seasons")
    
    # Get championships
    championships = await scraper.get_championships()
    print(f"Found {len(championships)} championships")
    
    # Get societies
    societies = await scraper.get_societies()
    print(f"Found {len(societies)} societies")
    
    # Scrape some matches
    matches = await scraper.scrape_matches()
    print(f"Found {len(matches)} matches")
    
    for match in matches[:5]:
        print(f"  - {match.date}: {match.home_team} vs {match.away_team}")
    
    return matches


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_fipav_scraper())
