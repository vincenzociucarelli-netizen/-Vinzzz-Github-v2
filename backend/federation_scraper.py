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
            championship_id: Filter by championship ID (CId parameter)
            season_id: Season ID (StId parameter)
            society_name: Name of society to match (for filtering results)
        """
        matches = []
        
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            # Build URL with parameters
            params = {'ComitatoId': self.comitato_id}
            if season_id:
                params['StId'] = season_id
            if society_id:
                params['SId'] = society_id
            if championship_id:
                params['CId'] = championship_id
            
            # Add btFiltro=CERCA to simulate clicking the search button
            params['btFiltro'] = 'CERCA'
            
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
    """Scraper for FIP (Federazione Italiana Pallacanestro) websites using official API"""
    
    API_BASE_URL = "https://backend.fip.it/api/v1"
    WEB_BASE_URL = "https://fip.it/risultati/"
    
    REGION_CODES = {
        "umbria": {"regione_codice": "UM", "comitato_codice": "RUM"},
        "lazio": {"regione_codice": "LA", "comitato_codice": "RLA"},
        "toscana": {"regione_codice": "TO", "comitato_codice": "RTO"},
        "emilia": {"regione_codice": "EM", "comitato_codice": "REM"},
        "lombardia": {"regione_codice": "LO", "comitato_codice": "RLO"},
        "piemonte": {"regione_codice": "PI", "comitato_codice": "RPI"},
        "veneto": {"regione_codice": "VE", "comitato_codice": "RVE"},
        "marche": {"regione_codice": "MA", "comitato_codice": "RMA"},
        "abruzzo": {"regione_codice": "AB", "comitato_codice": "RAB"},
        "campania": {"regione_codice": "CM", "comitato_codice": "RCM"},
        "puglia": {"regione_codice": "PU", "comitato_codice": "RPU"},
        "calabria": {"regione_codice": "CA", "comitato_codice": "RCA"},
        "sicilia": {"regione_codice": "SI", "comitato_codice": "RSI"},
        "sardegna": {"regione_codice": "SA", "comitato_codice": "RSA"},
    }
    
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
    }
    
    def __init__(self, region: str = "umbria"):
        self.region = region.lower()
        region_data = self.REGION_CODES.get(self.region, self.REGION_CODES["umbria"])
        self.regione_codice = region_data["regione_codice"]
        self.comitato_codice = region_data["comitato_codice"]
    
    async def get_championships(self, sesso: str = "M") -> List[Dict]:
        """
        Get available championships by scraping the web page.
        Returns list of {codice_campionato, codice_girone, nome}
        """
        championships = []
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            params = {
                'group': 'campionati-regionali',
                'regione_codice': self.regione_codice,
                'comitato_codice': self.comitato_codice,
                'sesso': sesso
            }
            
            response = await client.get(self.WEB_BASE_URL, params=params, headers=self.HEADERS)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract championship info from select options or links
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                if 'codice_campionato=' in href and 'codice_girone=' in href:
                    # Parse parameters
                    import urllib.parse
                    parsed = urllib.parse.urlparse(href)
                    query = urllib.parse.parse_qs(parsed.query)
                    
                    codice_campionato = query.get('codice_campionato', [''])[0]
                    codice_girone = query.get('codice_girone', [''])[0]
                    codice_fase = query.get('codice_fase', ['1'])[0]
                    
                    if codice_campionato and codice_girone:
                        # Get championship name
                        text = link.get_text(strip=True)
                        if text and not any(c['codice_girone'] == codice_girone for c in championships):
                            championships.append({
                                'codice_campionato': codice_campionato,
                                'codice_girone': codice_girone,
                                'codice_fase': codice_fase,
                                'nome': text or f"{codice_campionato} - {codice_girone}"
                            })
        
        return championships
    
    async def scrape_matches(
        self,
        codice_campionato: str,
        codice_girone: str,
        codice_fase: str = "1",
        giornata: Optional[int] = None,
        society_name: Optional[str] = None,
        sesso: str = "M"
    ) -> List[ScrapedMatch]:
        """
        Scrape matches from FIP API
        
        Args:
            codice_campionato: Championship code (e.g., "C1" for Serie C)
            codice_girone: Group code (e.g., "75008")
            codice_fase: Phase code (default "1")
            giornata: Specific matchday to fetch (if None, fetches all)
            society_name: Filter by team name
            sesso: "M" for male, "F" for female
        """
        matches = []
        
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            # Fetch multiple matchdays if giornata not specified
            giornate = [giornata] if giornata else list(range(1, 23))  # Max 22 giornate
            
            for gior in giornate:
                for codice_ar in [1, 0]:  # 1=andata, 0=ritorno
                    try:
                        api_url = f"{self.API_BASE_URL}/giornata"
                        params = {
                            'comitato_codice': self.comitato_codice,
                            'codice_campionato': codice_campionato,
                            'codice_fase': codice_fase,
                            'codice_girone': codice_girone,
                            'codice_ar': codice_ar,
                            'giornata': gior
                        }
                        
                        response = await client.get(api_url, params=params, headers=self.HEADERS)
                        
                        if response.status_code != 200:
                            continue
                        
                        data = response.json()
                        
                        if not data or not isinstance(data, list):
                            continue
                        
                        for giornata_data in data:
                            partite = giornata_data.get('partite', [])
                            
                            for partita in partite:
                                home_team = partita.get('casa', '')
                                away_team = partita.get('ospite', '')
                                
                                # Filter by society name if provided
                                if society_name:
                                    society_lower = society_name.lower()
                                    if society_lower not in home_team.lower() and society_lower not in away_team.lower():
                                        continue
                                
                                # Parse date
                                date_str = partita.get('data_partita', '')
                                time_str = partita.get('ora_partita', '00:00')
                                
                                try:
                                    match_date = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
                                except:
                                    try:
                                        match_date = datetime.strptime(date_str, "%Y-%m-%d")
                                    except:
                                        continue
                                
                                # Build result string
                                punti_casa = partita.get('punti_casa', -1)
                                punti_ospite = partita.get('punti_ospite', -1)
                                result = None
                                if punti_casa >= 0 and punti_ospite >= 0:
                                    result = f"{punti_casa}-{punti_ospite}"
                                
                                # Build venue string
                                venue_parts = []
                                if partita.get('campo_gioco'):
                                    venue_parts.append(partita.get('campo_gioco'))
                                if partita.get('indirizzo_campo_gioco'):
                                    venue_parts.append(partita.get('indirizzo_campo_gioco'))
                                if partita.get('citta_campo_gioco'):
                                    venue_parts.append(partita.get('citta_campo_gioco'))
                                venue = ', '.join(venue_parts) if venue_parts else None
                                
                                match = ScrapedMatch(
                                    match_number=partita.get('numero_gara', f"FIP-{match_date.strftime('%Y%m%d%H%M')}"),
                                    date=match_date,
                                    home_team=home_team,
                                    away_team=away_team,
                                    venue=venue,
                                    result=result,
                                    championship=codice_campionato,
                                    giornata=str(gior)
                                )
                                matches.append(match)
                                
                    except Exception as e:
                        logging.debug(f"Error fetching giornata {gior}: {e}")
                        continue
        
        # Remove duplicates based on match_number
        seen = set()
        unique_matches = []
        for match in matches:
            if match.match_number not in seen:
                seen.add(match.match_number)
                unique_matches.append(match)
        
        logging.info(f"Scraped {len(unique_matches)} matches from FIP")
        return unique_matches
    
    async def search_society(self, society_name: str, sesso: str = "M") -> List[Dict]:
        """
        Search for a society across all championships
        Returns list of matches containing the society
        """
        results = []
        
        # Get available championships
        championships = await self.get_championships(sesso)
        
        for champ in championships:
            matches = await self.scrape_matches(
                codice_campionato=champ['codice_campionato'],
                codice_girone=champ['codice_girone'],
                codice_fase=champ.get('codice_fase', '1'),
                society_name=society_name,
                sesso=sesso
            )
            
            if matches:
                results.extend([{
                    'championship': champ,
                    'match': match
                } for match in matches])
        
        return results


async def test_fip_scraper():
    """Test function to verify FIP scraper works"""
    scraper = FIPScraper(region="umbria")
    
    print("Testing FIP Umbria scraper...")
    
    # Test fetching a specific giornata
    matches = await scraper.scrape_matches(
        codice_campionato="C1",
        codice_girone="75008",
        giornata=7,
        society_name="PERUGIA"
    )
    
    print(f"Found {len(matches)} matches with 'PERUGIA':")
    for match in matches:
        print(f"  - {match.date}: {match.home_team} vs {match.away_team}")
        if match.venue:
            print(f"    Venue: {match.venue}")
    
    return matches


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
