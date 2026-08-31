import { generateMediaKitPdf } from '../lib/generate-media-kit-pdf';
import { mediaKit } from '../config/media-kit';
import { socialChannels } from '../config/site';

const socialUrls = Object.fromEntries(socialChannels.map((channel) => [channel.name, channel.url]));

async function handleDownload(button: HTMLButtonElement) {
  const original = button.textContent;
  button.textContent = 'Generating PDF…';
  button.disabled = true;

  try {
    await generateMediaKitPdf(mediaKit, socialUrls);
  } catch (error) {
    console.error('Media kit PDF generation failed:', error);
    alert('Sorry, the PDF could not be generated. Please try again or use the contact email.');
  } finally {
    button.textContent = original;
    button.disabled = false;
  }
}

document.querySelectorAll<HTMLButtonElement>('.media-kit-download').forEach((button) => {
  button.addEventListener('click', () => {
    void handleDownload(button);
  });
});
