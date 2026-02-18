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
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            params = {'ComitatoId': self.comitato_id}
            response = await client.get(self.base_url, params=params, headers=self.HEADERS)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            seasons = []
            # Look for season select - it has various IDs
            for select in soup.find_all('select'):
                select_id = select.get('id', '')
                select_name = select.get('name', '')
                if 'Stagione' in select_id or 'Stagione' in select_name or 'StId' in select_name:
                    for option in select.find_all('option'):
                        value = option.get('value', '')
                        text = option.get_text(strip=True)
                        if value and text:
                            seasons.append({'id': value, 'name': text})
                    break
            
            return seasons
    
    async def get_championships(self, season_id: Optional[str] = None) -> List[Dict]:
        """Get available championships for a season"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            params = {'ComitatoId': self.comitato_id}
            if season_id:
                params['StId'] = season_id
            
            response = await client.get(self.base_url, params=params, headers=self.HEADERS)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            championships = []
            for select in soup.find_all('select'):
                select_id = select.get('id', '')
                select_name = select.get('name', '')
                if 'Campionato' in select_id or 'Campionato' in select_name or 'CId' in select_name:
                    for option in select.find_all('option'):
                        value = option.get('value', '')
                        text = option.get_text(strip=True)
                        if value and text and 'Tutti' not in text:
                            championships.append({'id': value, 'name': text})
                    break
            
            return championships
    
    async def get_societies(self, season_id: Optional[str] = None) -> List[Dict]:
        """Get available societies/teams for a season"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            params = {'ComitatoId': self.comitato_id}
            if season_id:
                params['StId'] = season_id
            
            response = await client.get(self.base_url, params=params, headers=self.HEADERS)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            societies = []
            for select in soup.find_all('select'):
                select_id = select.get('id', '')
                select_name = select.get('name', '')
                if 'Societa' in select_id or 'Societa' in select_name or 'SId' in select_name:
                    for option in select.find_all('option'):
                        value = option.get('value', '')
                        text = option.get_text(strip=True)
                        if value and text and 'Tutte' not in text:
                            societies.append({'id': value, 'name': text})
                    break
            
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
            championship_id: Filter by championship ID (CId parameter) - NOT USED when society_id is set
            season_id: Season ID (StId parameter)
            society_name: Name of society to match (for filtering results)
        """
        matches = []
        
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            # Build URL with parameters
            # NOTE: Using CId and SId together doesn't work on FIPAV site
            # So we only use SId when available, and filter by society_name in results
            params = {'ComitatoId': self.comitato_id}
            if season_id:
                params['StId'] = season_id
            
            # Use society_id filter on the site (this works well)
            if society_id:
                params['SId'] = society_id
            # Only use championship filter if no society filter
            elif championship_id:
                params['CId'] = championship_id
            
            logging.info(f"Scraping FIPAV: {self.base_url} with params {params}")
            
            response = await client.get(self.base_url, params=params, headers=self.HEADERS)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all tables - the first table usually contains match data
            tables = soup.find_all('table')
            
            for table in tables:
                rows = table.find_all('tr')
                
                # Check if this is a match table by looking at the header
                if len(rows) < 2:
                    continue
                    
                header_cells = rows[0].find_all(['th', 'td'])
                header_texts = [c.get_text(strip=True).lower() for c in header_cells]
                
                # Match table has: Gara, G, Data/ora, Squadra casa, Squadra ospite, Risul.
                if not any('gara' in h or 'data' in h for h in header_texts):
                    continue
                
                # Process data rows (skip header)
                for row in rows[1:]:
                    cells = row.find_all('td')
                    if len(cells) < 6:
                        continue
                    
                    cell_texts = [c.get_text(strip=True) for c in cells]
                    
                    try:
                        # Structure: Gara, G (giornata), Data/ora, Squadra casa, Squadra ospite, Risul.
                        match_number = cell_texts[0] if cell_texts[0].isdigit() else None
                        giornata = cell_texts[1] if len(cell_texts) > 1 else None
                        
                        # Parse date/time
                        date_str = cell_texts[2] if len(cell_texts) > 2 else ""
                        date_match = re.search(r'(\d{2}/\d{2}/\d{2})\s*(\d{2}:\d{2})?', date_str)
                        if not date_match:
                            continue
                            
                        date_part = date_match.group(1)
                        time_part = date_match.group(2) or "00:00"
                        match_date = datetime.strptime(f"{date_part} {time_part}", "%d/%m/%y %H:%M")
                        
                        # Teams
                        home_team = cell_texts[3] if len(cell_texts) > 3 else ""
                        away_team = cell_texts[4] if len(cell_texts) > 4 else ""
                        
                        # Result
                        result = cell_texts[5] if len(cell_texts) > 5 else None
                        if result and '-' not in result:
                            result = None
                        
                        # Filter by society name if provided
                        if society_name:
                            society_lower = society_name.lower()
                            if society_lower not in home_team.lower() and society_lower not in away_team.lower():
                                continue
                        
                        match = ScrapedMatch(
                            match_number=match_number or f"FIPAV-{match_date.strftime('%Y%m%d%H%M')}",
                            date=match_date,
                            home_team=home_team,
                            away_team=away_team,
                            result=result,
                            giornata=giornata
                        )
                        matches.append(match)
                        
                    except Exception as e:
                        logging.debug(f"Error parsing row: {e}")
                        continue
        
        logging.info(f"Scraped {len(matches)} matches from FIPAV")
        return matches


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
