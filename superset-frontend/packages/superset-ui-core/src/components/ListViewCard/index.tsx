/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { FC } from 'react';
import { styled, useTheme, css } from '@apache-superset/core/theme';
import { Skeleton } from '../Skeleton';
import { Card } from '../Card';
import { CertifiedBadge } from '../CertifiedBadge';
import { Tooltip } from '../Tooltip';
import { ImageLoader } from './ImageLoader';
import type { ListViewCardProps, LinkProps } from './types';

const ActionsWrapper = styled.div`
  width: 64px;
  display: flex;
  justify-content: flex-end;
`;

// Styling part 2: Use CSS when necessary
const StyledCard = styled(Card)`
  ${({ theme }) => `
    overflow: hidden;

    .gradient-container {
      position: relative;
      height: 100%;
    }
    &:hover {
      box-shadow: ${theme.boxShadow};
      transition: box-shadow ${theme.motionDurationSlow} ease-in-out;

      .cover-footer {
        transform: translateY(0);
      }
    }
  `}
`;

const Cover = styled.div`
  height: 264px;
  border-bottom: 1px solid ${({ theme }) => theme.colorSplit};
  overflow: hidden;

  .cover-footer {
    transform: translateY(${({ theme }) => theme.sizeUnit * 9}px);
    transition: ${({ theme }) => theme.motionDurationMid} ease-out;
  }
`;

const TitleContainer = styled.div`
  display: flex;
  justify-content: flex-start;
  flex-direction: column;

  .card-actions {
    margin-left: auto;
    align-self: flex-end;
    padding-left: ${({ theme }) => theme.sizeUnit}px;
    span[role='img'] {
      display: flex;
      align-items: center;
    }
  }

  .titleRow {
    display: flex;
    justify-content: flex-start;
    flex-direction: row;
  }
`;

const TitleLink = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  & a {
    color: ${({ theme }) => theme.colorText} !important;
  }
`;

const TitleRight = styled.span`
  ${({ theme }) => css`
    position: absolute;
    right: -1px;
    font-weight: 400;
    bottom: ${theme.sizeUnit * 3}px;
    right: ${theme.sizeUnit * 2}px;
  `}
`;
const CoverFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  row-gap: ${({ theme }) => theme.sizeUnit}px;
  position: relative;
  top: -${({ theme }) => theme.sizeUnit * 9}px;
  padding: 0 8px;
`;

const CoverFooterLeft = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const CoverFooterRight = styled.div`
  align-self: flex-end;
  margin-left: auto;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ThinSkeleton = styled(Skeleton)`
  h3 {
    margin: ${({ theme }) => theme.sizeUnit}px 0;
  }

  ul {
    margin: 0;
  }
`;

/* The skeleton takes the loaded card's shape: one title row and one line of
   description, each as tall as its line of text, so the card neither grows
   past a loaded card (and gets cut off by the card grid's max-height) nor
   changes height when it loads. */
const SkeletonTitleRow = styled.div`
  display: flex;
  align-items: center;
  height: ${({ theme }) => theme.fontSizeLG * theme.lineHeight}px;
`;

const SKELETON_PARAGRAPH_HEIGHT = 16; // antd's skeleton paragraph line

const SkeletonDescription = styled.div`
  padding-block: ${({ theme }) =>
    (theme.fontSize * theme.lineHeight - SKELETON_PARAGRAPH_HEIGHT) / 2}px;
`;

const paragraphConfig = { rows: 1, width: 150 };

const AnchorLink: FC<LinkProps> = ({ to, children }) => (
  <a href={to}>{children}</a>
);

function ListViewCard({
  title,
  subtitle,
  url,
  linkComponent,
  titleRight,
  imgURL,
  imgFallbackURL,
  description,
  coverLeft,
  coverRight,
  actions,
  avatar,
  loading,
  imgPosition = 'top',
  cover,
  certifiedBy,
  certificationDetails,
}: ListViewCardProps) {
  const Link = url && linkComponent ? linkComponent : AnchorLink;
  const theme = useTheme();
  return (
    <StyledCard
      data-test="styled-card"
      padded
      cover={
        cover || (
          <Cover>
            <Link to={url!}>
              <div className="gradient-container">
                <ImageLoader
                  src={imgURL || ''}
                  fallback={imgFallbackURL || ''}
                  isLoading={loading}
                  position={imgPosition}
                />
              </div>
            </Link>
            <CoverFooter className="cover-footer">
              {!loading && coverLeft && (
                <CoverFooterLeft>{coverLeft}</CoverFooterLeft>
              )}
              {!loading && coverRight && (
                <CoverFooterRight>{coverRight}</CoverFooterRight>
              )}
            </CoverFooter>
          </Cover>
        )
      }
    >
      {loading && (
        <Card.Meta
          data-test="skeleton-card"
          title={
            <TitleContainer>
              <SkeletonTitleRow>
                <Skeleton.Input
                  active
                  size="small"
                  css={{
                    width: Math.trunc(theme.sizeUnit * 50),
                  }}
                />
                <div className="card-actions">
                  <Skeleton.Button active size="small" shape="circle" />{' '}
                  <Skeleton.Button
                    active
                    size="small"
                    css={{
                      width: theme.sizeUnit * 10,
                    }}
                  />
                </div>
              </SkeletonTitleRow>
            </TitleContainer>
          }
          description={
            <SkeletonDescription>
              <ThinSkeleton
                round
                active
                title={false}
                paragraph={paragraphConfig}
              />
            </SkeletonDescription>
          }
        />
      )}
      {!loading && (
        <Card.Meta
          title={
            <TitleContainer>
              {subtitle || null}
              <div className="titleRow">
                <Tooltip title={title}>
                  <TitleLink>
                    {certifiedBy && (
                      <>
                        <CertifiedBadge
                          certifiedBy={certifiedBy}
                          details={certificationDetails}
                        />{' '}
                      </>
                    )}
                    {title}
                  </TitleLink>
                </Tooltip>
                {titleRight && <TitleRight>{titleRight}</TitleRight>}
                <div className="card-actions" data-test="card-actions">
                  {actions}
                </div>
              </div>
            </TitleContainer>
          }
          description={description}
          avatar={avatar || null}
        />
      )}
    </StyledCard>
  );
}

ListViewCard.Actions = ActionsWrapper;

export { ListViewCard, ImageLoader };
export type { ListViewCardProps };
