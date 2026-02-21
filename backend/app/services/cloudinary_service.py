import cloudinary
import cloudinary.uploader
from fastapi import UploadFile
from app.core.config import settings

def init_cloudinary():
    if not settings.CLOUDINARY_API_KEY:
        print("Cloudinary not configured. Image uploads will fail.")
        return
        
    cloudinary.config( 
        cloud_name=settings.CLOUDINARY_CLOUD_NAME, 
        api_key=settings.CLOUDINARY_API_KEY, 
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )

async def upload_image(file: UploadFile, folder: str = "plants") -> str:
    """
    Uploads an image to Cloudinary and returns the secure URL.
    """
    if not settings.CLOUDINARY_API_KEY:
        raise ValueError("Cloudinary is not configured.")
        
    try:
        # Read the file content
        contents = await file.read()
        
        # Upload using cloudinary
        upload_result = cloudinary.uploader.upload(
            contents,
            folder=folder,
            resource_type="image"
        )
        
        # Reset file pointer just in case
        await file.seek(0)
        
        return upload_result.get("secure_url")
    except Exception as e:
        raise Exception(f"Failed to upload image: {str(e)}")
