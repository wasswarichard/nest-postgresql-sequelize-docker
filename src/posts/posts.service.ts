import { Injectable } from '@nestjs/common';
import { CreatePostDto, postStatus } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from './models/post.model';
import { Op } from 'sequelize';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PostsService {
  private readonly s3Client = new S3Client({
    region: this.configService.getOrThrow('AWS_S3_REGION'),
  });
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    private readonly configService: ConfigService,
  ) {}

  async fileUpload(files: Array<Express.Multer.File>): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const { originalname, buffer } = file;
      await this.s3Client.send(
          new PutObjectCommand({
            Bucket: 'treeofilebucket',
            Key: originalname,
            Body: buffer,
          }),
      );
      urls.push(`https://treeofilebucket.s3.amazonaws.com/${originalname}`)
    }
   return urls;
  }

  create(createPostDto: CreatePostDto & { authorId: number, files: string }): Promise<Post> {
    return this.postModel.create({ ...createPostDto });
  }

  findAll(authorId: number): Promise<Post[]> {
    return this.postModel.findAll({
      where: {
        [Op.or]: [{ authorId: authorId }, { status: postStatus.PUBLIC }],
        deletedAt: {
          [Op.or]: {
            [Op.eq]: null,
            [Op.gt]: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
          },
        },
      },
    });
  }

  findOne(id: number): Promise<Post> {
    return this.postModel.findOne({ where: { id } });
  }

  async update(
    id: number,
    updatePostDto: UpdatePostDto & { authorId: number },
  ): Promise<Post[]> {
    const [_, affectedRows] = await this.postModel.update(updatePostDto, {
      where: { id },
      returning: true,
    });
    return affectedRows;
  }

  async remove(id: number): Promise<void> {
    const postToDelete = await this.findOne(id);
    if (postToDelete) {
      postToDelete.deletedAt = new Date();
      await postToDelete.save();
    }
  }
}
