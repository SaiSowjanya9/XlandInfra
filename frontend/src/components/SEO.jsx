import { useEffect } from 'react';

const SEO = ({ 
  title, 
  description, 
  keywords,
  canonical,
  ogType = 'website'
}) => {
  const baseTitle = 'XLAND INFRA PVT LTD';
  const fullTitle = title ? `${title} | ${baseTitle}` : baseTitle;
  
  useEffect(() => {
    // Update document title
    document.title = fullTitle;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && description) {
      metaDescription.setAttribute('content', description);
    }
    
    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords && keywords) {
      metaKeywords.setAttribute('content', keywords);
    }
    
    // Update OG title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', fullTitle);
    }
    
    // Update OG description
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription && description) {
      ogDescription.setAttribute('content', description);
    }
    
    // Update OG type
    const ogTypeTag = document.querySelector('meta[property="og:type"]');
    if (ogTypeTag) {
      ogTypeTag.setAttribute('content', ogType);
    }
    
    // Update Twitter title
    const twitterTitle = document.querySelector('meta[property="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute('content', fullTitle);
    }
    
    // Update Twitter description
    const twitterDescription = document.querySelector('meta[property="twitter:description"]');
    if (twitterDescription && description) {
      twitterDescription.setAttribute('content', description);
    }
    
    // Update canonical URL
    const canonicalTag = document.querySelector('link[rel="canonical"]');
    if (canonicalTag && canonical) {
      canonicalTag.setAttribute('href', canonical);
    }
    
    // Cleanup - reset to defaults when unmounting
    return () => {
      document.title = 'XLAND INFRA PVT LTD | Premium Real Estate Development & Infrastructure Services';
    };
  }, [fullTitle, description, keywords, canonical, ogType]);
  
  return null;
};

export default SEO;
