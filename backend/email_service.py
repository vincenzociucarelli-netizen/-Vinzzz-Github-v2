"""
Email Service - Brevo Integration with SendGrid Fallback
Handles all email sending for RegistraTEAM application
"""

import os
import json
import base64
import logging
import requests
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Configuration
BREVO_API_KEY = os.environ.get("BREVO_API_KEY")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
# Read SENDER_EMAIL (current standard) or SENDGRID_FROM_EMAIL (legacy fallback)
SENDER_EMAIL = os.environ.get("SENDER_EMAIL") or os.environ.get("SENDGRID_FROM_EMAIL", "assistenza@registrateam.it")
SENDER_NAME = os.environ.get("SENDER_NAME", "RegistraTEAM")

# Determine which service to use
USE_BREVO = bool(BREVO_API_KEY)
USE_SENDGRID = bool(SENDGRID_API_KEY) and not USE_BREVO


class EmailService:
    """Unified email service supporting Brevo and SendGrid"""
    
    def __init__(self):
        self.brevo_api_url = "https://api.brevo.com/v3/smtp/email"
        self.brevo_headers = {
            "accept": "application/json",
            "api-key": BREVO_API_KEY or "",
            "content-type": "application/json",
        }
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        to_name: Optional[str] = None,
        text_content: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        cc_list: Optional[List[str]] = None,
        bcc_list: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Send email using Brevo (primary) or SendGrid (fallback)
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML body
            to_name: Recipient name (optional)
            text_content: Plain text body (optional)
            attachments: List of attachments [{name, content (base64), type}]
            cc_list: CC email addresses
            bcc_list: BCC email addresses
            
        Returns:
            Dict with success status and message_id
        """
        
        if USE_BREVO:
            return await self._send_via_brevo(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                to_name=to_name,
                text_content=text_content,
                attachments=attachments,
                cc_list=cc_list,
                bcc_list=bcc_list,
            )
        elif USE_SENDGRID:
            return await self._send_via_sendgrid(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                to_name=to_name,
                text_content=text_content,
                attachments=attachments,
                cc_list=cc_list,
                bcc_list=bcc_list,
            )
        else:
            logger.warning("No email service configured (BREVO_API_KEY or SENDGRID_API_KEY)")
            return {"success": False, "error": "No email service configured"}
    
    async def _send_via_brevo(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        to_name: Optional[str] = None,
        text_content: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        cc_list: Optional[List[str]] = None,
        bcc_list: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Send email via Brevo API"""
        
        # Build recipient
        to_recipient = {"email": to_email}
        if to_name:
            to_recipient["name"] = to_name
        
        # Build payload
        payload = {
            "sender": {
                "name": SENDER_NAME,
                "email": SENDER_EMAIL
            },
            "to": [to_recipient],
            "subject": subject,
            "htmlContent": html_content,
        }
        
        if text_content:
            payload["textContent"] = text_content
        
        # Add CC
        if cc_list:
            payload["cc"] = [{"email": email} for email in cc_list]
        
        # Add BCC
        if bcc_list:
            payload["bcc"] = [{"email": email} for email in bcc_list]
        
        # Add attachments
        if attachments:
            payload["attachment"] = []
            for att in attachments:
                payload["attachment"].append({
                    "content": att.get("content", ""),
                    "name": att.get("name", "attachment")
                })
        
        try:
            response = requests.post(
                self.brevo_api_url,
                headers=self.brevo_headers,
                data=json.dumps(payload),
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            message_id = result.get("messageId", "")
            logger.info(f"Brevo: Email sent to {to_email}. Message ID: {message_id}")
            
            return {
                "success": True,
                "message_id": message_id,
                "provider": "brevo"
            }
            
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    error_msg = error_detail.get("message", str(e))
                except:
                    pass
            
            logger.error(f"Brevo: Failed to send email to {to_email}: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "provider": "brevo"
            }
    
    async def _send_via_sendgrid(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        to_name: Optional[str] = None,
        text_content: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        cc_list: Optional[List[str]] = None,
        bcc_list: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Send email via SendGrid API"""
        
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import (
                Mail, Attachment, FileContent, FileName, FileType, Disposition
            )
            
            message = Mail(
                from_email=SENDER_EMAIL,
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            
            if text_content:
                message.plain_text_content = text_content
            
            # Add attachments
            if attachments:
                for att in attachments:
                    attachment = Attachment()
                    attachment.file_content = FileContent(att.get("content", ""))
                    attachment.file_name = FileName(att.get("name", "attachment"))
                    attachment.file_type = FileType(att.get("type", "application/pdf"))
                    attachment.disposition = Disposition("attachment")
                    message.add_attachment(attachment)
            
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            response = sg.send(message)
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"SendGrid: Email sent to {to_email}")
                return {
                    "success": True,
                    "message_id": response.headers.get("X-Message-Id", ""),
                    "provider": "sendgrid"
                }
            else:
                logger.error(f"SendGrid: Failed with status {response.status_code}")
                return {
                    "success": False,
                    "error": f"Status code: {response.status_code}",
                    "provider": "sendgrid"
                }
                
        except Exception as e:
            logger.error(f"SendGrid: Failed to send email to {to_email}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "provider": "sendgrid"
            }


# Singleton instance
email_service = EmailService()


async def send_transactional_email(
    to_email: str,
    subject: str,
    html_content: str,
    **kwargs
) -> Dict[str, Any]:
    """Convenience function for sending transactional emails"""
    return await email_service.send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        **kwargs
    )


async def send_email_with_pdf(
    to_email: str,
    subject: str,
    html_content: str,
    pdf_base64: str,
    pdf_filename: str,
    cc_email: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """Send email with PDF attachment"""
    
    attachments = [{
        "content": pdf_base64,
        "name": pdf_filename,
        "type": "application/pdf"
    }]
    
    cc_list = [cc_email] if cc_email else None
    
    return await email_service.send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        attachments=attachments,
        cc_list=cc_list,
        **kwargs
    )
